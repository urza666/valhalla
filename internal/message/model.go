package message

import "time"

// Message types
const (
	TypeDefault    = 0
	TypeReply      = 19
	TypeThreadStart = 21
)

type Message struct {
	ID              int64       `json:"id,string"`
	ChannelID       int64       `json:"channel_id,string"`
	Author          *Author     `json:"author"`
	Content         string      `json:"content"`
	EditedAt        *time.Time  `json:"edited_timestamp"`
	TTS             bool        `json:"tts"`
	MentionEveryone bool        `json:"mention_everyone"`
	Pinned          bool        `json:"pinned"`
	Type            int         `json:"type"`
	Flags           int         `json:"flags"`
	ReferenceID     *int64      `json:"message_reference,string,omitempty"`
	Nonce           *string     `json:"nonce,omitempty"`
	CreatedAt       time.Time   `json:"timestamp"`
	// Populated separately
	Mentions     []int64     `json:"mentions,omitempty"`
	MentionRoles []int64     `json:"mention_roles,omitempty"`
	Reactions    []Reaction  `json:"reactions,omitempty"`
	Attachments  []Attachment `json:"attachments,omitempty"`
}

type Author struct {
	ID          int64   `json:"id,string"`
	Username    string  `json:"username"`
	DisplayName *string `json:"display_name"`
	AvatarHash  *string `json:"avatar"`
}

type Reaction struct {
	Emoji string `json:"emoji"`
	Count int    `json:"count"`
	Me    bool   `json:"me"`
}

type Attachment struct {
	ID          int64   `json:"id,string"`
	Filename    string  `json:"filename"`
	ContentType *string `json:"content_type"`
	Size        int64   `json:"size"`
	URL         string  `json:"url"`
	Width       *int    `json:"width"`
	Height      *int    `json:"height"`
}

type CreateMessageRequest struct {
	Content     string  `json:"content"`
	Nonce       *string `json:"nonce,omitempty"`
	TTS         bool    `json:"tts"`
	ReferenceID *int64  `json:"message_reference,string,omitempty"`
}

type UpdateMessageRequest struct {
	Content string `json:"content"`
}

type MessagesQuery struct {
	Before int64
	After  int64
	Limit  int
}
