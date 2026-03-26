package apierror

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
)

// RequireIDParam extracts a URL param as int64, writing a 400 error and returning 0, false on failure.
func RequireIDParam(w http.ResponseWriter, r *http.Request, name string) (int64, bool) {
	raw := chi.URLParam(r, name)
	if raw == "" {
		NewBadRequest("Missing required parameter: " + name).Write(w)
		return 0, false
	}
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		NewBadRequest("Invalid ID for parameter: " + name).Write(w)
		return 0, false
	}
	return id, true
}
