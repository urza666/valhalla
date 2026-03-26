package eventbus

import (
	"encoding/json"
	"fmt"

	"github.com/nats-io/nats.go"
	"github.com/rs/zerolog/log"

	"github.com/valhalla-chat/valhalla/pkg/events"
)

// NATSDispatcher publishes events to NATS subjects for cross-node distribution.
// It implements events.EventDispatcher.
type NATSDispatcher struct {
	nc *nats.Conn
}

// Ensure NATSDispatcher implements EventDispatcher at compile time.
var _ events.EventDispatcher = (*NATSDispatcher)(nil)

// EventPayload is the JSON structure published to NATS.
type EventPayload struct {
	GuildID   int64  `json:"guild_id,omitempty"`
	ChannelID int64  `json:"channel_id,omitempty"`
	UserID    int64  `json:"user_id,omitempty"`
	Event     string `json:"event"`
	Data      any    `json:"data"`
}

// NewNATSDispatcher connects to NATS and returns a dispatcher.
func NewNATSDispatcher(url string) (*NATSDispatcher, error) {
	nc, err := nats.Connect(url,
		nats.RetryOnFailedConnect(true),
		nats.MaxReconnects(-1), // Reconnect forever
		nats.DisconnectErrHandler(func(_ *nats.Conn, err error) {
			log.Warn().Err(err).Msg("[NATS] Disconnected")
		}),
		nats.ReconnectHandler(func(_ *nats.Conn) {
			log.Info().Msg("[NATS] Reconnected")
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("nats connect: %w", err)
	}

	log.Info().Str("url", url).Msg("[NATS] Connected")
	return &NATSDispatcher{nc: nc}, nil
}

// DispatchToGuild publishes an event for all members of a guild.
func (d *NATSDispatcher) DispatchToGuild(guildID int64, eventName string, data any) {
	d.publish(fmt.Sprintf("valhalla.guild.%d", guildID), EventPayload{
		GuildID: guildID,
		Event:   eventName,
		Data:    data,
	})
}

// DispatchToChannel publishes an event for a specific channel.
func (d *NATSDispatcher) DispatchToChannel(guildID int64, channelID int64, eventName string, data any) {
	d.publish(fmt.Sprintf("valhalla.guild.%d", guildID), EventPayload{
		GuildID:   guildID,
		ChannelID: channelID,
		Event:     eventName,
		Data:      data,
	})
}

// DispatchToUser publishes an event for a specific user (DMs, notifications).
func (d *NATSDispatcher) DispatchToUser(userID int64, eventName string, data any) {
	d.publish(fmt.Sprintf("valhalla.user.%d", userID), EventPayload{
		UserID: userID,
		Event:  eventName,
		Data:   data,
	})
}

func (d *NATSDispatcher) publish(subject string, payload EventPayload) {
	data, err := json.Marshal(payload)
	if err != nil {
		log.Error().Err(err).Str("subject", subject).Msg("[NATS] Failed to marshal event")
		return
	}
	if err := d.nc.Publish(subject, data); err != nil {
		log.Error().Err(err).Str("subject", subject).Msg("[NATS] Failed to publish event")
	}
}

// Close closes the NATS connection.
func (d *NATSDispatcher) Close() {
	d.nc.Close()
}
