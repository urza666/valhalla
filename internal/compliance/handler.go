package compliance

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

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

// --- Retention Policies ---

func (h *Handler) GetRetentionPolicies(w http.ResponseWriter, r *http.Request) {
	guildID, ok := apierror.RequireIDParam(w, r, "guildID")
	if !ok {
		return
	}

	policies, err := h.service.GetRetentionPolicies(r.Context(), guildID)
	if err != nil {
		apierror.NewInternal("Fehler beim Laden der Aufbewahrungsrichtlinien").Write(w)
		return
	}
	if policies == nil {
		policies = []RetentionPolicy{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(policies)
}

func (h *Handler) CreateRetentionPolicy(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	guildID, ok := apierror.RequireIDParam(w, r, "guildID")
	if !ok {
		return
	}

	var req struct {
		ChannelID     *int64 `json:"channel_id,string"`
		RetentionDays int    `json:"retention_days"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Ungültiger Request").Write(w)
		return
	}
	if req.RetentionDays < 1 || req.RetentionDays > 3650 {
		apierror.NewValidationError("retention_days muss zwischen 1 und 3650 liegen").Write(w)
		return
	}

	policy, err := h.service.CreateRetentionPolicy(r.Context(), guildID, req.ChannelID, req.RetentionDays, user.ID)
	if err != nil {
		apierror.NewInternal("Fehler beim Erstellen der Richtlinie").Write(w)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(policy)
}

func (h *Handler) DeleteRetentionPolicy(w http.ResponseWriter, r *http.Request) {
	policyID, err := strconv.ParseInt(chi.URLParam(r, "policyID"), 10, 64)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	_, err = h.service.db.Exec(r.Context(), `DELETE FROM retention_policies WHERE id = $1`, policyID)
	if err != nil {
		apierror.NewInternal("Fehler beim Löschen der Richtlinie").Write(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- Legal Holds ---

func (h *Handler) GetLegalHolds(w http.ResponseWriter, r *http.Request) {
	guildID, ok := apierror.RequireIDParam(w, r, "guildID")
	if !ok {
		return
	}

	holds, err := h.service.GetLegalHolds(r.Context(), guildID)
	if err != nil {
		apierror.NewInternal("Fehler beim Laden der Legal Holds").Write(w)
		return
	}
	if holds == nil {
		holds = []LegalHold{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(holds)
}

func (h *Handler) CreateLegalHold(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	guildID, ok := apierror.RequireIDParam(w, r, "guildID")
	if !ok {
		return
	}

	var req struct {
		Name        string     `json:"name"`
		Description *string    `json:"description"`
		ChannelIDs  []int64    `json:"channel_ids"`
		UserIDs     []int64    `json:"user_ids"`
		StartDate   time.Time  `json:"start_date"`
		EndDate     *time.Time `json:"end_date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Ungültiger Request").Write(w)
		return
	}
	if req.Name == "" {
		apierror.NewValidationError("Name ist erforderlich").Write(w)
		return
	}

	hold, err := h.service.CreateLegalHold(r.Context(), guildID, user.ID, req.Name, req.Description, req.ChannelIDs, req.UserIDs, req.StartDate, req.EndDate)
	if err != nil {
		apierror.NewInternal("Fehler beim Erstellen des Legal Hold").Write(w)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(hold)
}

func (h *Handler) ReleaseLegalHold(w http.ResponseWriter, r *http.Request) {
	holdID, err := strconv.ParseInt(chi.URLParam(r, "holdID"), 10, 64)
	if err != nil {
		apierror.ErrNotFound.Write(w)
		return
	}

	if err := h.service.ReleaseLegalHold(r.Context(), holdID); err != nil {
		apierror.NewInternal("Fehler beim Aufheben des Legal Hold").Write(w)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- Audit Exports ---

func (h *Handler) GetExports(w http.ResponseWriter, r *http.Request) {
	guildID, ok := apierror.RequireIDParam(w, r, "guildID")
	if !ok {
		return
	}

	exports, err := h.service.GetExports(r.Context(), guildID)
	if err != nil {
		apierror.NewInternal("Fehler beim Laden der Exporte").Write(w)
		return
	}
	if exports == nil {
		exports = []AuditExport{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(exports)
}

func (h *Handler) RequestExport(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	guildID, ok := apierror.RequireIDParam(w, r, "guildID")
	if !ok {
		return
	}

	var req struct {
		Filters any `json:"filters"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	export, err := h.service.RequestExport(r.Context(), guildID, user.ID, req.Filters)
	if err != nil {
		apierror.NewInternal("Fehler beim Anfordern des Exports").Write(w)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(export)
}

// --- Consent Management ---

func (h *Handler) GetConsentSettings(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())

	rows, err := h.service.db.Query(r.Context(), `
		SELECT consent_type, granted, updated_at FROM user_consent WHERE user_id = $1
	`, user.ID)
	if err != nil {
		apierror.NewInternal("Fehler beim Laden der Einwilligungen").Write(w)
		return
	}
	defer rows.Close()

	type ConsentEntry struct {
		Type      string    `json:"type"`
		Granted   bool      `json:"granted"`
		UpdatedAt time.Time `json:"updated_at"`
	}

	var entries []ConsentEntry
	for rows.Next() {
		var e ConsentEntry
		rows.Scan(&e.Type, &e.Granted, &e.UpdatedAt)
		entries = append(entries, e)
	}
	if entries == nil {
		entries = []ConsentEntry{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

func (h *Handler) UpdateConsentSetting(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())

	var req struct {
		Type    string `json:"type"`
		Granted bool   `json:"granted"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apierror.NewBadRequest("Ungültiger Request").Write(w)
		return
	}

	validTypes := map[string]bool{
		"tenor_gif": true, "link_previews": true, "analytics": true, "email_notifications": true,
	}
	if !validTypes[req.Type] {
		apierror.NewValidationError("Ungültiger Consent-Typ").Write(w)
		return
	}

	_, err := h.service.db.Exec(r.Context(), `
		INSERT INTO user_consent (user_id, consent_type, granted) VALUES ($1, $2, $3)
		ON CONFLICT (user_id, consent_type) DO UPDATE SET granted = $3, updated_at = NOW()
	`, user.ID, req.Type, req.Granted)
	if err != nil {
		apierror.NewInternal("Fehler beim Speichern der Einwilligung").Write(w)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
