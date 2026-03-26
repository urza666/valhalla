package wiki

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/valhalla-chat/valhalla/internal/auth"
	"github.com/valhalla-chat/valhalla/pkg/apierror"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// GetGuildPages handles GET /api/v1/guilds/{guildID}/wiki
func (h *Handler) GetGuildPages(w http.ResponseWriter, r *http.Request) {
	guildID, _ := strconv.ParseInt(chi.URLParam(r, "guildID"), 10, 64)
	pages, err := h.service.GetGuildPages(r.Context(), guildID)
	if err != nil {
		apierror.NewInternal("Failed to fetch pages").Write(w)
		return
	}
	if pages == nil {
		pages = []Page{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(pages)
}

// CreatePage handles POST /api/v1/guilds/{guildID}/wiki
func (h *Handler) CreatePage(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	guildID, _ := strconv.ParseInt(chi.URLParam(r, "guildID"), 10, 64)

	var req struct {
		Title     string `json:"title"`
		Content   string `json:"content"`
		ChannelID *int64 `json:"channel_id,string,omitempty"`
		ParentID  *int64 `json:"parent_id,string,omitempty"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	page, err := h.service.CreatePage(r.Context(), guildID, req.ChannelID, user.ID, req.Title, req.Content, req.ParentID)
	if err != nil {
		apierror.NewInternal("Failed to create page").Write(w)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(page)
}

// GetPage handles GET /api/v1/wiki/{pageID}
func (h *Handler) GetPage(w http.ResponseWriter, r *http.Request) {
	pageID, _ := strconv.ParseInt(chi.URLParam(r, "pageID"), 10, 64)
	page, err := h.service.GetPage(r.Context(), pageID)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(page)
}

// UpdatePage handles PATCH /api/v1/wiki/{pageID}
func (h *Handler) UpdatePage(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	pageID, _ := strconv.ParseInt(chi.URLParam(r, "pageID"), 10, 64)

	var req struct {
		Title   *string `json:"title,omitempty"`
		Content *string `json:"content,omitempty"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	page, err := h.service.UpdatePage(r.Context(), pageID, user.ID, req.Title, req.Content)
	if err != nil {
		apierror.NewInternal("Failed to update page").Write(w)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(page)
}

// DeletePage handles DELETE /api/v1/wiki/{pageID}
func (h *Handler) DeletePage(w http.ResponseWriter, r *http.Request) {
	pageID, _ := strconv.ParseInt(chi.URLParam(r, "pageID"), 10, 64)
	h.service.DeletePage(r.Context(), pageID)
	w.WriteHeader(http.StatusNoContent)
}

// GetRevisions handles GET /api/v1/wiki/{pageID}/revisions
func (h *Handler) GetRevisions(w http.ResponseWriter, r *http.Request) {
	pageID, _ := strconv.ParseInt(chi.URLParam(r, "pageID"), 10, 64)
	revisions, err := h.service.GetRevisions(r.Context(), pageID, 20)
	if err != nil {
		apierror.NewInternal("Failed to fetch revisions").Write(w)
		return
	}
	if revisions == nil {
		revisions = []Revision{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(revisions)
}
