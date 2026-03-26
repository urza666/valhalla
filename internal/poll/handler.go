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
