package dm

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

// GetUserDMs handles GET /api/v1/users/@me/channels
func (h *Handler) GetUserDMs(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())

	dms, err := h.service.GetUserDMs(r.Context(), user.ID)
	if err != nil {
		apierror.NewInternal("Failed to fetch DMs").Write(w)
		return
	}
	if dms == nil {
		dms = []DMChannel{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(dms)
}

// CreateDM handles POST /api/v1/users/@me/channels
func (h *Handler) CreateDM(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())

	var req CreateDMRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Invalid request body").Write(w)
		return
	}

	if req.RecipientID == user.ID {
		apierror.NewBadRequest("Cannot create DM with yourself").Write(w)
		return
	}

	ch, err := h.service.GetOrCreateDM(r.Context(), user.ID, req.RecipientID)
	if err != nil {
		apierror.NewInternal("Failed to create DM").Write(w)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(ch)
}

// CloseDM handles DELETE /api/v1/channels/{channelID}  (for DM channels)
func (h *Handler) CloseDM(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	channelID, err := strconv.ParseInt(chi.URLParam(r, "channelID"), 10, 64)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	canAccess, _ := h.service.CanAccessDM(r.Context(), channelID, user.ID)
	if !canAccess {
		apierror.ErrForbidden.Write(w)
		return
	}

	h.service.CloseDM(r.Context(), channelID, user.ID)
	w.WriteHeader(http.StatusNoContent)
}
