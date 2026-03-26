package events

// EventDispatcher defines the interface for dispatching real-time events.
// Handlers use this interface instead of depending on *gateway.Server directly,
// enabling testing with mocks and future replacement with NATS/Redis Pub-Sub.
type EventDispatcher interface {
	DispatchToGuild(guildID int64, eventName string, data any)
	DispatchToChannel(guildID int64, channelID int64, eventName string, data any)
	DispatchToUser(userID int64, eventName string, data any)
}

// NoopDispatcher is a no-op implementation for testing.
type NoopDispatcher struct{}

func (NoopDispatcher) DispatchToGuild(int64, string, any)        {}
func (NoopDispatcher) DispatchToChannel(int64, int64, string, any) {}
func (NoopDispatcher) DispatchToUser(int64, string, any)          {}
