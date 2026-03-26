package voice

// VoiceState represents a user's current voice connection state.
type VoiceState struct {
	GuildID   int64  `json:"guild_id,string"`
	ChannelID *int64 `json:"channel_id,string"` // nil = not connected
	UserID    int64  `json:"user_id,string"`
	SessionID string `json:"session_id"`
	SelfMute  bool   `json:"self_mute"`
	SelfDeaf  bool   `json:"self_deaf"`
	Mute      bool   `json:"mute"`      // server-side mute
	Deaf      bool   `json:"deaf"`      // server-side deaf
	SelfVideo bool   `json:"self_video"`
	Stream    bool   `json:"self_stream"`
	Suppress  bool   `json:"suppress"` // suppressed in stage channel
}

// VoiceStateUpdate is sent by the client to join/leave/update voice.
type VoiceStateUpdate struct {
	GuildID   int64  `json:"guild_id,string"`
	ChannelID *int64 `json:"channel_id,string"` // nil = disconnect
	SelfMute  *bool  `json:"self_mute,omitempty"`
	SelfDeaf  *bool  `json:"self_deaf,omitempty"`
	SelfVideo *bool  `json:"self_video,omitempty"`
	SelfStream *bool `json:"self_stream,omitempty"`
}

// VoiceServerInfo is returned to the client after joining a voice channel.
type VoiceServerInfo struct {
	Token    string `json:"token"`     // LiveKit access token
	Endpoint string `json:"endpoint"`  // LiveKit WebSocket URL
}

// JoinVoiceResponse is returned after successfully joining voice.
type JoinVoiceResponse struct {
	VoiceState VoiceState      `json:"voice_state"`
	Server     VoiceServerInfo `json:"server"`
}

// VoiceChannelUsers represents users in a voice channel (for display).
type VoiceChannelUser struct {
	UserID    int64   `json:"user_id,string"`
	Username  string  `json:"username"`
	AvatarHash *string `json:"avatar"`
	SelfMute  bool    `json:"self_mute"`
	SelfDeaf  bool    `json:"self_deaf"`
	Speaking  bool    `json:"speaking"`
}
