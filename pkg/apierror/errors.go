package apierror

import (
	"encoding/json"
	"net/http"
)

// Error codes (inspired by Discord's error system).
const (
	CodeUnknown            = 0
	CodeUnauthorized       = 40001
	CodeMissingPermissions = 50013
	CodeInvalidFormBody    = 50035
	CodeResourceNotFound   = 10003
	CodeAlreadyExists      = 40002
	CodeRateLimited        = 40029
	CodeValidationFailed   = 50000
)

// APIError represents a structured API error response.
type APIError struct {
	HTTPStatus int    `json:"-"`
	Code       int    `json:"code"`
	Message    string `json:"message"`
}

func (e *APIError) Error() string {
	return e.Message
}

// Write writes the error response to the HTTP response writer.
func (e *APIError) Write(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(e.HTTPStatus)
	json.NewEncoder(w).Encode(e)
}

// Common errors
var (
	ErrUnauthorized = &APIError{
		HTTPStatus: http.StatusUnauthorized,
		Code:       CodeUnauthorized,
		Message:    "401: Unauthorized",
	}

	ErrForbidden = &APIError{
		HTTPStatus: http.StatusForbidden,
		Code:       CodeMissingPermissions,
		Message:    "Missing Permissions",
	}

	ErrNotFound = &APIError{
		HTTPStatus: http.StatusNotFound,
		Code:       CodeResourceNotFound,
		Message:    "Unknown resource",
	}

	ErrRateLimited = &APIError{
		HTTPStatus: http.StatusTooManyRequests,
		Code:       CodeRateLimited,
		Message:    "You are being rate limited",
	}
)

// NewValidationError creates a validation error with a custom message.
func NewValidationError(msg string) *APIError {
	return &APIError{
		HTTPStatus: http.StatusBadRequest,
		Code:       CodeValidationFailed,
		Message:    msg,
	}
}

// NewBadRequest creates a bad request error.
func NewBadRequest(msg string) *APIError {
	return &APIError{
		HTTPStatus: http.StatusBadRequest,
		Code:       CodeInvalidFormBody,
		Message:    msg,
	}
}

// NewConflict creates a conflict error.
func NewConflict(msg string) *APIError {
	return &APIError{
		HTTPStatus: http.StatusConflict,
		Code:       CodeAlreadyExists,
		Message:    msg,
	}
}

// NewInternal creates an internal server error.
func NewInternal(msg string) *APIError {
	return &APIError{
		HTTPStatus: http.StatusInternalServerError,
		Code:       CodeUnknown,
		Message:    msg,
	}
}
