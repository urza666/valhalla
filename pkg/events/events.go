package events

import "encoding/json"

// Gateway Opcodes (mirrors Discord protocol)
const (
	OpcodeDispatch            = 0  // Server → Client: Event dispatch
	OpcodeHeartbeat           = 1  // Bidirectional: Keep-alive
	OpcodeIdentify            = 2  // Client → Server: Auth + session start
	OpcodePresenceUpdate      = 3  // Client → Server: Update own presence
	OpcodeVoiceStateUpdate    = 4  // Client → Server: Voice channel join/leave
	OpcodeResume              = 6  // Client → Server: Resume session
	OpcodeReconnect           = 7  // Server → Client: Reconnect requested
	OpcodeRequestGuildMembers = 8  // Client → Server: Lazy load members
	OpcodeInvalidSession      = 9  // Server → Client: Session invalid
	OpcodeHello               = 10 // Server → Client: Heartbeat interval
	OpcodeHeartbeatACK        = 11 // Server → Client: Heartbeat acknowledged
)

// Event names (dispatch events)
const (
	EventReady             = "READY"
	EventResumed           = "RESUMED"
	EventGuildCreate       = "GUILD_CREATE"
	EventGuildUpdate       = "GUILD_UPDATE"
	EventGuildDelete       = "GUILD_DELETE"
	EventGuildMemberAdd    = "GUILD_MEMBER_ADD"
	EventGuildMemberRemove = "GUILD_MEMBER_REMOVE"
	EventGuildMemberUpdate = "GUILD_MEMBER_UPDATE"
	EventGuildRoleCreate   = "GUILD_ROLE_CREATE"
	EventGuildRoleUpdate   = "GUILD_ROLE_UPDATE"
	EventGuildRoleDelete   = "GUILD_ROLE_DELETE"
	EventChannelCreate     = "CHANNEL_CREATE"
	EventChannelUpdate     = "CHANNEL_UPDATE"
	EventChannelDelete     = "CHANNEL_DELETE"
	EventMessageCreate     = "MESSAGE_CREATE"
	EventMessageUpdate     = "MESSAGE_UPDATE"
	EventMessageDelete     = "MESSAGE_DELETE"
	EventMessageReactionAdd    = "MESSAGE_REACTION_ADD"
	EventMessageReactionRemove = "MESSAGE_REACTION_REMOVE"
	EventPresenceUpdate    = "PRESENCE_UPDATE"
	EventTypingStart       = "TYPING_START"
	EventVoiceStateUpdate  = "VOICE_STATE_UPDATE"
	EventVoiceServerUpdate = "VOICE_SERVER_UPDATE"
)

// GatewayPayload is the envelope for all gateway messages.
type GatewayPayload struct {
	Op       int              `json:"op"`
	Data     json.RawMessage  `json:"d,omitempty"`
	Sequence *int64           `json:"s,omitempty"`
	Type     string           `json:"t,omitempty"`
}

// HelloData is sent by the server after connection.
type HelloData struct {
	HeartbeatInterval int `json:"heartbeat_interval"` // milliseconds
}

// IdentifyData is sent by the client to authenticate.
type IdentifyData struct {
	Token      string            `json:"token"`
	Properties map[string]string `json:"properties,omitempty"`
}

// ResumeData is sent by the client to resume a session.
type ResumeData struct {
	Token     string `json:"token"`
	SessionID string `json:"session_id"`
	Sequence  int64  `json:"seq"`
}

// ReadyData is sent by the server after successful identify.
type ReadyData struct {
	Version          int      `json:"v"`
	User             any      `json:"user"`
	Guilds           []any    `json:"guilds"`
	SessionID        string   `json:"session_id"`
	ResumeGatewayURL string   `json:"resume_gateway_url"`
}

// PresenceUpdateData is sent by the client to update their own presence,
// and dispatched to other users when someone's presence changes.
type PresenceUpdateData struct {
	UserID     int64      `json:"user_id,string,omitempty"` // Set by server on dispatch
	Status     string     `json:"status"`                   // online, idle, dnd, invisible
	Activities []Activity `json:"activities,omitempty"`
}

// Activity represents a user activity (e.g., playing a game).
type Activity struct {
	Name string `json:"name"`
	Type int    `json:"type"` // 0=Playing, 1=Streaming, 2=Listening, 3=Watching, 4=Custom
}

// TypingStartData is dispatched when a user starts typing.
type TypingStartData struct {
	ChannelID int64 `json:"channel_id,string"`
	GuildID   int64 `json:"guild_id,string,omitempty"`
	UserID    int64 `json:"user_id,string"`
	Timestamp int64 `json:"timestamp"`
}
