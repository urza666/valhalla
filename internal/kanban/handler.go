package kanban

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

// GetChannelBoards handles GET /api/v1/channels/{channelID}/boards
func (h *Handler) GetChannelBoards(w http.ResponseWriter, r *http.Request) {
	channelID, _ := strconv.ParseInt(chi.URLParam(r, "channelID"), 10, 64)
	boards, err := h.service.GetChannelBoards(r.Context(), channelID)
	if err != nil {
		apierror.NewInternal("Failed to fetch boards").Write(w)
		return
	}
	if boards == nil {
		boards = []Board{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(boards)
}

// CreateBoard handles POST /api/v1/channels/{channelID}/boards
func (h *Handler) CreateBoard(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	channelID, _ := strconv.ParseInt(chi.URLParam(r, "channelID"), 10, 64)

	var req struct {
		Name    string `json:"name"`
		GuildID int64  `json:"guild_id,string"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	if req.Name == "" {
		req.Name = "Board"
	}

	board, err := h.service.CreateBoard(r.Context(), channelID, req.GuildID, user.ID, req.Name)
	if err != nil {
		apierror.NewInternal("Failed to create board").Write(w)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(board)
}

// GetBoard handles GET /api/v1/boards/{boardID}
func (h *Handler) GetBoard(w http.ResponseWriter, r *http.Request) {
	boardID, _ := strconv.ParseInt(chi.URLParam(r, "boardID"), 10, 64)
	board, err := h.service.GetBoard(r.Context(), boardID)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(board)
}

// CreateBucket handles POST /api/v1/boards/{boardID}/buckets
func (h *Handler) CreateBucket(w http.ResponseWriter, r *http.Request) {
	boardID, _ := strconv.ParseInt(chi.URLParam(r, "boardID"), 10, 64)
	var req struct {
		Name     string `json:"name"`
		Position int    `json:"position"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	bucket, err := h.service.CreateBucket(r.Context(), boardID, req.Name, req.Position)
	if err != nil {
		apierror.NewInternal("Failed to create bucket").Write(w)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(bucket)
}

// CreateTask handles POST /api/v1/boards/{boardID}/tasks
func (h *Handler) CreateTask(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	boardID, _ := strconv.ParseInt(chi.URLParam(r, "boardID"), 10, 64)

	var req struct {
		BucketID int64  `json:"bucket_id,string"`
		Title    string `json:"title"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	task, err := h.service.CreateTask(r.Context(), boardID, req.BucketID, user.ID, req.Title)
	if err != nil {
		apierror.NewInternal("Failed to create task").Write(w)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(task)
}

// UpdateTask handles PATCH /api/v1/tasks/{taskID}
func (h *Handler) UpdateTask(w http.ResponseWriter, r *http.Request) {
	taskID, _ := strconv.ParseInt(chi.URLParam(r, "taskID"), 10, 64)

	var updates map[string]any
	json.NewDecoder(r.Body).Decode(&updates)

	task, err := h.service.UpdateTask(r.Context(), taskID, updates)
	if err != nil {
		apierror.NewInternal("Failed to update task").Write(w)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(task)
}

// MoveTask handles POST /api/v1/tasks/{taskID}/move
func (h *Handler) MoveTask(w http.ResponseWriter, r *http.Request) {
	taskID, _ := strconv.ParseInt(chi.URLParam(r, "taskID"), 10, 64)

	var req struct {
		BucketID int64 `json:"bucket_id,string"`
		Position int   `json:"position"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	if err := h.service.MoveTask(r.Context(), taskID, req.BucketID, req.Position); err != nil {
		apierror.NewInternal("Failed to move task").Write(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DeleteTask handles DELETE /api/v1/tasks/{taskID}
func (h *Handler) DeleteTask(w http.ResponseWriter, r *http.Request) {
	taskID, _ := strconv.ParseInt(chi.URLParam(r, "taskID"), 10, 64)
	if err := h.service.DeleteTask(r.Context(), taskID); err != nil {
		apierror.NewInternal("Failed to delete task").Write(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
