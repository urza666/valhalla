package message

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/valhalla-chat/valhalla/internal/auth"
	"github.com/valhalla-chat/valhalla/internal/embed"
	"github.com/valhalla-chat/valhalla/pkg/apierror"
	"github.com/valhalla-chat/valhalla/pkg/events"
	"github.com/valhalla-chat/valhalla/pkg/metrics"
	"github.com/valhalla-chat/valhalla/pkg/permissions"
	"github.com/valhalla-chat/valhalla/pkg/snowflake"
)

type Handler struct {
	repo         *Repository
	idGen        *snowflake.Generator
	dispatcher   events.EventDispatcher
	uploadDir    string
	embedService *embed.Service
	perms        *permissions.Resolver
}

const maxUploadSize = 25 * 1024 * 1024 // 25 MB

// Allowed file extensions for upload
var allowedExtensions = map[string]bool{
	".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true,
	".mp4": true, ".webm": true, ".mov": true,
	".mp3": true, ".ogg": true, ".wav": true, ".flac": true,
	".pdf": true, ".txt": true, ".csv": true,
	".zip": true, ".gz": true, ".tar": true,
	".doc": true, ".docx": true, ".xls": true, ".xlsx": true, ".pptx": true,
	".json": true, ".xml": true, ".yaml": true, ".yml": true,
}

func NewHandler(repo *Repository, idGen *snowflake.Generator, dispatcher events.EventDispatcher, embedSvc *embed.Service, perms *permissions.Resolver) *Handler {
	uploadDir := "uploads"
	os.MkdirAll(uploadDir, 0o755)
	return &Handler{repo: repo, idGen: idGen, dispatcher: dispatcher, uploadDir: uploadDir, embedService: embedSvc, perms: perms}
}

// isGuildMember checks if a user is a member of the given guild.
func (h *Handler) isGuildMember(ctx context.Context, userID, guildID int64) bool {
	var exists bool
	h.repo.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM members WHERE user_id = $1 AND guild_id = $2)`, userID, guildID).Scan(&exists)
	return exists
}

// GetMessages handles GET /api/v1/channels/{channelID}/messages
func (h *Handler) GetMessages(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	channelID, err := strconv.ParseInt(chi.URLParam(r, "channelID"), 10, 64)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	// Permission check: user must be guild member
	guildID := h.repo.GetChannelGuildID(r.Context(), channelID)
	if guildID != 0 && !h.isGuildMember(r.Context(), user.ID, guildID) {
		apierror.ErrForbidden.Write(w)
		return
	}

	q := MessagesQuery{Limit: 50}
	if v := r.URL.Query().Get("before"); v != "" {
		q.Before, _ = strconv.ParseInt(v, 10, 64)
	}
	if v := r.URL.Query().Get("after"); v != "" {
		q.After, _ = strconv.ParseInt(v, 10, 64)
	}
	if v := r.URL.Query().Get("limit"); v != "" {
		q.Limit, _ = strconv.Atoi(v)
	}

	messages, err := h.repo.GetMessages(r.Context(), channelID, q)
	if err != nil {
		apierror.NewInternal("Failed to fetch messages").Write(w)
		return
	}
	if messages == nil {
		messages = []Message{}
	}

	// Batch-load attachments and reactions for all messages
	if len(messages) > 0 {
		msgIDs := make([]int64, len(messages))
		for i, m := range messages {
			msgIDs[i] = m.ID
		}

		// Attachments
		attMap, _ := h.repo.GetAttachments(r.Context(), msgIDs)
		if attMap != nil {
			for i := range messages {
				if atts, ok := attMap[messages[i].ID]; ok {
					messages[i].Attachments = atts
				}
			}
		}

		// Reactions (batch instead of N+1)
		reactMap, _ := h.repo.GetReactionsBatch(r.Context(), msgIDs, user.ID)
		if reactMap != nil {
			for i := range messages {
				if reacts, ok := reactMap[messages[i].ID]; ok {
					messages[i].Reactions = reacts
				}
			}
		}

		// Embeds (link previews)
		embedMap, _ := h.repo.GetEmbeds(r.Context(), msgIDs)
		if embedMap != nil {
			for i := range messages {
				if embs, ok := embedMap[messages[i].ID]; ok {
					messages[i].Embeds = embs
				}
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}

// CreateMessage handles POST /api/v1/channels/{channelID}/messages
func (h *Handler) CreateMessage(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	channelID, err := strconv.ParseInt(chi.URLParam(r, "channelID"), 10, 64)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	var req CreateMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Invalid request body").Write(w)
		return
	}

	hasAttachments := len(req.AttachmentIDs) > 0
	if len(req.Content) == 0 && !hasAttachments {
		apierror.NewValidationError("Message must have content or attachments").Write(w)
		return
	}
	if len(req.Content) > 4000 {
		apierror.NewValidationError("Message content must be at most 4000 characters").Write(w)
		return
	}

	// Permission check: user must be guild member
	guildID := h.repo.GetChannelGuildID(r.Context(), channelID)
	if guildID != 0 && !h.isGuildMember(r.Context(), user.ID, guildID) {
		apierror.ErrForbidden.Write(w)
		return
	}

	msgID := h.idGen.Generate().Int64()
	msg, err := h.repo.Create(r.Context(), msgID, channelID, user.ID, req)
	if err != nil {
		apierror.NewInternal("Failed to create message").Write(w)
		return
	}

	// Save attachments to DB and link to message
	if hasAttachments {
		for _, attID := range req.AttachmentIDs {
			// The attachment file info was stored in a pending_attachments in-memory map
			// For simplicity, we insert into DB from the metadata sent by client
			h.repo.LinkPendingAttachment(r.Context(), attID, msgID)
		}
		// Load attachments for the response
		attMap, _ := h.repo.GetAttachments(r.Context(), []int64{msgID})
		if atts, ok := attMap[msgID]; ok {
			msg.Attachments = atts
		}
	}

	// Extract link previews asynchronously (non-blocking)
	if h.embedService != nil && len(req.Content) > 0 {
		go func() {
			bgCtx, bgCancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer bgCancel()
			embeds := h.embedService.ExtractEmbeds(bgCtx, req.Content)
			if len(embeds) > 0 {
				var msgEmbeds []MessageEmbed
				for _, e := range embeds {
					me := MessageEmbed{
						Type: e.Type, URL: e.URL, Title: e.Title,
						Description: e.Description, Color: e.Color, SiteName: e.SiteName,
					}
					if e.Thumbnail != nil {
						me.Thumbnail = &EmbedMedia{URL: e.Thumbnail.URL, Width: e.Thumbnail.Width, Height: e.Thumbnail.Height}
					}
					if e.Image != nil {
						me.Image = &EmbedMedia{URL: e.Image.URL, Width: e.Image.Width, Height: e.Image.Height}
					}
					if e.Provider != nil {
						me.Provider = &EmbedProvider{Name: e.Provider.Name, URL: e.Provider.URL}
					}
					embedID := h.idGen.Generate().Int64()
					h.repo.SaveEmbed(bgCtx, embedID, msgID, me)
					msgEmbeds = append(msgEmbeds, me)
				}
				// Dispatch embed update so clients see the previews
				if h.dispatcher != nil {
					msg.Embeds = msgEmbeds
					h.dispatcher.DispatchToChannel(guildID, channelID, events.EventMessageUpdate, msg)
				}
			}
		}()
	}

	// Dispatch MESSAGE_CREATE to all subscribers via WebSocket Gateway
	if h.dispatcher != nil {
		h.dispatcher.DispatchToChannel(guildID, channelID, events.EventMessageCreate, msg)
	}

	metrics.IncrMessages()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(msg)
}

// UpdateMessage handles PATCH /api/v1/channels/{channelID}/messages/{messageID}
func (h *Handler) UpdateMessage(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	messageID, err := strconv.ParseInt(chi.URLParam(r, "messageID"), 10, 64)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	// Only the author can edit their own message
	authorID, err := h.repo.GetAuthorID(r.Context(), messageID)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}
	if authorID != user.ID {
		apierror.ErrForbidden.Write(w)
		return
	}

	var req UpdateMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Invalid request body").Write(w)
		return
	}

	msg, err := h.repo.Update(r.Context(), messageID, req.Content)
	if err != nil {
		apierror.NewInternal("Failed to update message").Write(w)
		return
	}

	if h.dispatcher != nil {
		gID := h.repo.GetChannelGuildID(r.Context(), msg.ChannelID)
		h.dispatcher.DispatchToChannel(gID, msg.ChannelID, events.EventMessageUpdate, msg)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(msg)
}

// DeleteMessage handles DELETE /api/v1/channels/{channelID}/messages/{messageID}
func (h *Handler) DeleteMessage(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	channelID, ok := apierror.RequireIDParam(w, r, "channelID")
	if !ok {
		return
	}
	messageID, ok := apierror.RequireIDParam(w, r, "messageID")
	if !ok {
		return
	}

	// Author or MANAGE_MESSAGES permission
	authorID, err := h.repo.GetAuthorID(r.Context(), messageID)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}
	if authorID != user.ID {
		guildID := h.repo.GetChannelGuildID(r.Context(), channelID)
		if guildID != 0 && h.perms != nil {
			hasPerm, _ := h.perms.HasGuildPerm(r.Context(), user.ID, guildID, permissions.ManageMessages)
			if !hasPerm {
				apierror.ErrForbidden.Write(w)
				return
			}
		} else {
			apierror.ErrForbidden.Write(w)
			return
		}
	}

	if err := h.repo.Delete(r.Context(), messageID); err != nil {
		apierror.NewInternal("Failed to delete message").Write(w)
		return
	}

	if h.dispatcher != nil {
		delGuildID := h.repo.GetChannelGuildID(r.Context(), channelID)
		h.dispatcher.DispatchToChannel(delGuildID, channelID, events.EventMessageDelete, map[string]any{
			"id":         strconv.FormatInt(messageID, 10),
			"channel_id": strconv.FormatInt(channelID, 10),
		})
	}

	w.WriteHeader(http.StatusNoContent)
}

// AddReaction handles PUT /api/v1/channels/{channelID}/messages/{messageID}/reactions/{emoji}/@me
func (h *Handler) AddReaction(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	channelID, ok := apierror.RequireIDParam(w, r, "channelID")
	if !ok { return }
	messageID, ok := apierror.RequireIDParam(w, r, "messageID")
	if !ok { return }
	emoji := chi.URLParam(r, "emoji")

	if err := h.repo.AddReaction(r.Context(), messageID, user.ID, emoji); err != nil {
		apierror.NewInternal("Failed to add reaction").Write(w)
		return
	}

	if h.dispatcher != nil {
		rGuildID := h.repo.GetChannelGuildID(r.Context(), channelID)
		h.dispatcher.DispatchToChannel(rGuildID, channelID, events.EventMessageReactionAdd, map[string]any{
			"user_id":    strconv.FormatInt(user.ID, 10),
			"channel_id": strconv.FormatInt(channelID, 10),
			"message_id": strconv.FormatInt(messageID, 10),
			"emoji":      emoji,
		})
	}

	w.WriteHeader(http.StatusNoContent)
}

// RemoveReaction handles DELETE /api/v1/channels/{channelID}/messages/{messageID}/reactions/{emoji}/@me
func (h *Handler) RemoveReaction(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	channelID, ok := apierror.RequireIDParam(w, r, "channelID")
	if !ok { return }
	messageID, ok := apierror.RequireIDParam(w, r, "messageID")
	if !ok { return }
	emoji := chi.URLParam(r, "emoji")

	if err := h.repo.RemoveReaction(r.Context(), messageID, user.ID, emoji); err != nil {
		apierror.NewInternal("Failed to remove reaction").Write(w)
		return
	}

	if h.dispatcher != nil {
		rrGuildID := h.repo.GetChannelGuildID(r.Context(), channelID)
		h.dispatcher.DispatchToChannel(rrGuildID, channelID, events.EventMessageReactionRemove, map[string]any{
			"user_id":    strconv.FormatInt(user.ID, 10),
			"channel_id": strconv.FormatInt(channelID, 10),
			"message_id": strconv.FormatInt(messageID, 10),
			"emoji":      emoji,
		})
	}

	w.WriteHeader(http.StatusNoContent)
}

// PinMessage handles PUT /api/v1/channels/{channelID}/pins/{messageID}
func (h *Handler) PinMessage(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	channelID, err := strconv.ParseInt(chi.URLParam(r, "channelID"), 10, 64)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}
	messageID, err := strconv.ParseInt(chi.URLParam(r, "messageID"), 10, 64)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	// Permission check
	guildID := h.repo.GetChannelGuildID(r.Context(), channelID)
	if guildID != 0 && !h.isGuildMember(r.Context(), user.ID, guildID) {
		apierror.ErrForbidden.Write(w)
		return
	}

	// Update the message as pinned
	h.repo.db.Exec(r.Context(), `UPDATE messages SET pinned = true WHERE id = $1 AND channel_id = $2`, messageID, channelID)

	// Add to pinned_messages table
	h.repo.db.Exec(r.Context(), `
		INSERT INTO pinned_messages (channel_id, message_id, pinned_by)
		VALUES ($1, $2, $3) ON CONFLICT DO NOTHING
	`, channelID, messageID, user.ID)

	w.WriteHeader(http.StatusNoContent)
}

// UnpinMessage handles DELETE /api/v1/channels/{channelID}/pins/{messageID}
func (h *Handler) UnpinMessage(w http.ResponseWriter, r *http.Request) {
	channelID, _ := strconv.ParseInt(chi.URLParam(r, "channelID"), 10, 64)
	messageID, _ := strconv.ParseInt(chi.URLParam(r, "messageID"), 10, 64)

	h.repo.db.Exec(r.Context(), `UPDATE messages SET pinned = false WHERE id = $1 AND channel_id = $2`, messageID, channelID)
	h.repo.db.Exec(r.Context(), `DELETE FROM pinned_messages WHERE channel_id = $1 AND message_id = $2`, channelID, messageID)

	w.WriteHeader(http.StatusNoContent)
}

// GetPinnedMessages handles GET /api/v1/channels/{channelID}/pins
func (h *Handler) GetPinnedMessages(w http.ResponseWriter, r *http.Request) {
	channelID, ok := apierror.RequireIDParam(w, r, "channelID")
	if !ok { return }

	pinned, err := h.repo.GetPinnedMessages(r.Context(), channelID)
	if err != nil {
		apierror.NewInternal("Failed to fetch pins").Write(w)
		return
	}
	if pinned == nil {
		pinned = []Message{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(pinned)
}

// AckMessage handles POST /api/v1/channels/{channelID}/messages/{messageID}/ack
func (h *Handler) AckMessage(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	channelID, ok := apierror.RequireIDParam(w, r, "channelID")
	if !ok { return }
	messageID, ok := apierror.RequireIDParam(w, r, "messageID")
	if !ok { return }

	if err := h.repo.AckMessage(r.Context(), user.ID, channelID, messageID); err != nil {
		apierror.NewInternal("Failed to ack message").Write(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ReportMessage handles POST /api/v1/channels/{channelID}/messages/{messageID}/report
func (h *Handler) ReportMessage(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	channelID, ok := apierror.RequireIDParam(w, r, "channelID")
	if !ok {
		return
	}
	messageID, ok := apierror.RequireIDParam(w, r, "messageID")
	if !ok {
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Reason == "" {
		apierror.NewBadRequest("Reason is required").Write(w)
		return
	}
	if len(req.Reason) > 1000 {
		apierror.NewBadRequest("Reason must be at most 1000 characters").Write(w)
		return
	}

	guildID := h.repo.GetChannelGuildID(r.Context(), channelID)
	reportID := h.idGen.Generate().Int64()

	// Get the message's author
	var targetUserID *int64
	authorID, err := h.repo.GetAuthorID(r.Context(), messageID)
	if err == nil {
		targetUserID = &authorID
	}

	_, err = h.repo.db.Exec(r.Context(), `
		INSERT INTO reports (id, reporter_id, guild_id, channel_id, message_id, target_user_id, reason)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, reportID, user.ID, guildID, channelID, messageID, targetUserID, req.Reason)
	if err != nil {
		apierror.NewInternal("Failed to create report").Write(w)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Report submitted"})
}

// UploadAttachment handles POST /api/v1/channels/{channelID}/attachments
func (h *Handler) UploadAttachment(w http.ResponseWriter, r *http.Request) {
	_ = auth.UserFromContext(r.Context())

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		apierror.NewBadRequest("Datei zu groß (max. 25 MB)").Write(w)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		apierror.NewBadRequest("Keine Datei im Request").Write(w)
		return
	}
	defer file.Close()

	// Validate file extension
	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !allowedExtensions[ext] {
		apierror.NewBadRequest("Dateityp nicht erlaubt: " + ext).Write(w)
		return
	}

	// Detect content type from actual file content (magic bytes), not from header
	buf := make([]byte, 512)
	n, _ := file.Read(buf)
	contentType := http.DetectContentType(buf[:n])
	file.Seek(0, 0) // Reset reader position

	// Block HTML/SVG/JS content types (XSS prevention)
	if strings.Contains(contentType, "html") || strings.Contains(contentType, "svg") || strings.Contains(contentType, "javascript") {
		apierror.NewBadRequest("Dateityp nicht erlaubt (HTML/SVG/JS)").Write(w)
		return
	}

	// Generate unique ID and safe filename
	attachID := h.idGen.Generate().Int64()
	safeFilename := fmt.Sprintf("%d%s", attachID, ext)

	// Ensure uploads directory exists
	os.MkdirAll(h.uploadDir, 0o755)

	// Write file to disk
	dst, err := os.Create(filepath.Join(h.uploadDir, safeFilename))
	if err != nil {
		apierror.NewInternal("Failed to store file").Write(w)
		return
	}
	defer dst.Close()

	written, err := io.Copy(dst, file)
	if err != nil {
		os.Remove(filepath.Join(h.uploadDir, safeFilename))
		apierror.NewInternal("Failed to write file").Write(w)
		return
	}

	// Build URL
	url := fmt.Sprintf("/api/v1/attachments/%s", safeFilename)

	// Detect image dimensions (basic — just return nil for now)
	isImage := strings.HasPrefix(contentType, "image/")
	var width, height *int
	_ = isImage

	attachment := Attachment{
		ID:          attachID,
		Filename:    header.Filename,
		ContentType: &contentType,
		Size:        written,
		URL:         url,
		Width:       width,
		Height:      height,
	}

	// Save to DB with NULL message_id (pending)
	h.repo.SavePendingAttachment(r.Context(), attachment)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(attachment)
}

// ServeAttachment handles GET /api/v1/attachments/{filename}
func (h *Handler) ServeAttachment(w http.ResponseWriter, r *http.Request) {
	filename := chi.URLParam(r, "filename")

	// Prevent path traversal
	filename = filepath.Base(filename)
	filePath := filepath.Join(h.uploadDir, filename)

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		apierror.ErrNotFound.Write(w)
		return
	}

	// Security headers to prevent XSS
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'")
	w.Header().Set("X-Frame-Options", "DENY")

	// Force download for non-image/video/audio types
	ext := strings.ToLower(filepath.Ext(filename))
	isInline := ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".gif" || ext == ".webp" ||
		ext == ".mp4" || ext == ".webm" || ext == ".mp3" || ext == ".ogg" || ext == ".pdf"
	if !isInline {
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
	}

	http.ServeFile(w, r, filePath)
}
