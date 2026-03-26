package dm

import "time"

// DMChannel represents a DM channel with recipient info.
type DMChannel struct {
	ID            int64     `json:"id,string"`
	Type          int       `json:"type"`
	LastMessageID *int64    `json:"last_message_id,string"`
	CreatedAt     time.Time `json:"created_at"`
	Recipient     Recipient `json:"recipient"`
}

// Recipient is the other user in a DM.
type Recipient struct {
	ID          int64   `json:"id,string"`
	Username    string  `json:"username"`
	DisplayName *string `json:"display_name"`
	AvatarHash  *string `json:"avatar"`
}

// CreateDMRequest is the payload for creating a DM.
type CreateDMRequest struct {
	RecipientID int64 `json:"recipient_id,string"`
}
