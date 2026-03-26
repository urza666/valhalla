package auth

import "time"

// RegisterRequest is the payload for user registration.
type RegisterRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

// LoginRequest is the payload for user login.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// TokenResponse is returned after successful auth.
type TokenResponse struct {
	Token string `json:"token"`
	User  *User  `json:"user"`
}

// User is the public user representation.
type User struct {
	ID          int64   `json:"id,string"`
	Username    string  `json:"username"`
	DisplayName *string `json:"display_name"`
	Email       string  `json:"email"`
	AvatarHash  *string `json:"avatar"`
	Bio         *string `json:"bio"`
	MFAEnabled  bool    `json:"mfa_enabled"`
	Verified    bool    `json:"verified"`
	Flags       int64   `json:"flags"`
	PremiumType int     `json:"premium_type"`
	Locale      string  `json:"locale"`
	CreatedAt   time.Time `json:"created_at"`
}

// Session represents an active user session.
type Session struct {
	Token      string    `json:"token"`
	UserID     int64     `json:"user_id,string"`
	DeviceInfo string    `json:"device_info"`
	IPAddress  string    `json:"ip_address"`
	CreatedAt  time.Time `json:"created_at"`
	ExpiresAt  time.Time `json:"expires_at"`
}
