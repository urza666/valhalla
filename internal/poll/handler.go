package poll

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

// CreatePoll handles POST /api/v1/channels/{channelID}/polls
func (h *Handler) CreatePoll(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	channelID, _ := strconv.ParseInt(chi.URLParam(r, "channelID"), 10, 64)

	var req struct {
		Question         string   `json:"question"`
		Options          []string `json:"options"`
		AllowMultiselect bool     `json:"allow_multiselect"`
		DurationHours    int      `json:"duration_hours"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Invalid request body").Write(w)
		return
	}

	if len(req.Options) < 2 {
		apierror.NewValidationError("Mindestens 2 Optionen noetig").Write(w)
		return
	}

	// Create a placeholder message for the poll first (FK constraint)
	msgID := h.service.idGen.Generate().Int64()
	h.service.db.Exec(r.Context(), `
		INSERT INTO messages (id, channel_id, author_id, content, type)
		VALUES ($1, $2, $3, $4, 0)
	`, msgID, channelID, user.ID, "📊 "+req.Question)

	poll, err := h.service.CreatePoll(r.Context(), msgID, channelID, user.ID, CreatePollRequest{
		Question:         req.Question,
		Options:          req.Options,
		AllowMultiselect: req.AllowMultiselect,
		DurationHours:    req.DurationHours,
	})
	if err != nil {
		apierror.NewInternal("Failed to create poll").Write(w)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(poll)
}

// GetPoll handles GET /api/v1/polls/{pollID}
func (h *Handler) GetPoll(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	pollID, _ := strconv.ParseInt(chi.URLParam(r, "pollID"), 10, 64)

	poll, err := h.service.GetPoll(r.Context(), pollID, user.ID)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(poll)
}

// Vote handles PUT /api/v1/polls/{pollID}/options/{optionID}/vote
func (h *Handler) Vote(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	pollID, _ := strconv.ParseInt(chi.URLParam(r, "pollID"), 10, 64)
	optionID, _ := strconv.ParseInt(chi.URLParam(r, "optionID"), 10, 64)

	if err := h.service.Vote(r.Context(), pollID, optionID, user.ID); err != nil {
		apierror.NewBadRequest(err.Error()).Write(w)
		return
	}

	// Return updated poll
	poll, _ := h.service.GetPoll(r.Context(), pollID, user.ID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(poll)
}

// Unvote handles DELETE /api/v1/polls/{pollID}/options/{optionID}/vote
func (h *Handler) Unvote(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	pollID, _ := strconv.ParseInt(chi.URLParam(r, "pollID"), 10, 64)
	optionID, _ := strconv.ParseInt(chi.URLParam(r, "optionID"), 10, 64)

	h.service.Unvote(r.Context(), pollID, optionID, user.ID)

	poll, _ := h.service.GetPoll(r.Context(), pollID, user.ID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(poll)
}
