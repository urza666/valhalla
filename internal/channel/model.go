package channel

import "time"

// Channel types
const (
	TypeText         = 0
	TypeDM           = 1
	TypeVoice        = 2
	TypeGroupDM      = 3
	TypeCategory     = 4
	TypeAnnouncement = 5
	TypePublicThread = 11
	TypePrivateThread = 12
	TypeStage        = 13
	TypeForum        = 15
)

type Channel struct {
	ID                  int64   `json:"id,string"`
	GuildID             *int64  `json:"guild_id,string"`
	Type                int     `json:"type"`
	Name                *string `json:"name"`
	Topic               *string `json:"topic"`
	Position            int     `json:"position"`
	ParentID            *int64  `json:"parent_id,string"`
	NSFW                bool    `json:"nsfw"`
	RateLimitPerUser    int     `json:"rate_limit_per_user"`
	Bitrate             int     `json:"bitrate,omitempty"`
	UserLimit           int     `json:"user_limit,omitempty"`
	LastMessageID       *int64  `json:"last_message_id,string"`
	PermissionOverwrites []Overwrite `json:"permission_overwrites,omitempty"`
	CreatedAt           time.Time `json:"created_at"`
}

type Overwrite struct {
	ID    int64 `json:"id,string"`
	Type  int   `json:"type"` // 0=role, 1=member
	Allow int64 `json:"allow,string"`
	Deny  int64 `json:"deny,string"`
}

type CreateChannelRequest struct {
	Name     string `json:"name"`
	Type     int    `json:"type"`
	Topic    *string `json:"topic,omitempty"`
	ParentID *int64 `json:"parent_id,string,omitempty"`
	Position *int   `json:"position,omitempty"`
	NSFW     bool   `json:"nsfw"`
}

type UpdateChannelRequest struct {
	Name             *string `json:"name,omitempty"`
	Topic            *string `json:"topic,omitempty"`
	Position         *int    `json:"position,omitempty"`
	ParentID         *int64  `json:"parent_id,string,omitempty"`
	NSFW             *bool   `json:"nsfw,omitempty"`
	RateLimitPerUser *int    `json:"rate_limit_per_user,omitempty"`
	Bitrate          *int    `json:"bitrate,omitempty"`
	UserLimit        *int    `json:"user_limit,omitempty"`
}
