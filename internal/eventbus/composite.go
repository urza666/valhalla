package eventbus

import (
	"github.com/nats-io/nats.go"
	"github.com/valhalla-chat/valhalla/pkg/events"
)

// CompositeDispatcher dispatches events both locally (to in-process Gateway)
// and to NATS (for other instances to pick up). This is the production dispatcher.
type CompositeDispatcher struct {
	local events.EventDispatcher // Local gateway (in-process WebSocket delivery)
	nats  *NATSDispatcher        // NATS publisher (cross-node delivery)
}

// NewCompositeDispatcher creates a dispatcher that publishes to both local + NATS.
// Pass the NATS connection (shared with subscriber) and the local gateway.
func NewCompositeDispatcher(nc *nats.Conn, local events.EventDispatcher) *CompositeDispatcher {
	return &CompositeDispatcher{
		local: local,
		nats:  &NATSDispatcher{nc: nc},
	}
}

func (d *CompositeDispatcher) DispatchToGuild(guildID int64, eventName string, data any) {
	d.local.DispatchToGuild(guildID, eventName, data)
	d.nats.DispatchToGuild(guildID, eventName, data)
}

func (d *CompositeDispatcher) DispatchToChannel(guildID int64, channelID int64, eventName string, data any) {
	d.local.DispatchToChannel(guildID, channelID, eventName, data)
	d.nats.DispatchToChannel(guildID, channelID, eventName, data)
}

func (d *CompositeDispatcher) DispatchToUser(userID int64, eventName string, data any) {
	d.local.DispatchToUser(userID, eventName, data)
	d.nats.DispatchToUser(userID, eventName, data)
}
