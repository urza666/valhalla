package eventbus

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/nats-io/nats.go"
	"github.com/rs/zerolog/log"

	"github.com/valhalla-chat/valhalla/pkg/events"
)

// NATSSubscriber listens for events from NATS and forwards them to the local Gateway.
// This enables horizontal scaling: multiple API instances publish to NATS,
// and each Gateway instance subscribes and dispatches to its local WebSocket sessions.
type NATSSubscriber struct {
	nc       *nats.Conn
	local    events.EventDispatcher
	subs     []*nats.Subscription
}

// NewNATSSubscriber creates a subscriber that bridges NATS → local Gateway.
func NewNATSSubscriber(nc *nats.Conn, localDispatcher events.EventDispatcher) *NATSSubscriber {
	return &NATSSubscriber{nc: nc, local: localDispatcher}
}

// SubscribeAll subscribes to guild and user event subjects.
func (s *NATSSubscriber) SubscribeAll() error {
	// Subscribe to all guild events: valhalla.guild.*
	guildSub, err := s.nc.Subscribe("valhalla.guild.*", func(msg *nats.Msg) {
		var payload EventPayload
		if err := json.Unmarshal(msg.Data, &payload); err != nil {
			log.Error().Err(err).Msg("[NATS] Failed to unmarshal guild event")
			return
		}

		// Forward to local gateway
		if payload.ChannelID != 0 {
			s.local.DispatchToChannel(payload.GuildID, payload.ChannelID, payload.Event, payload.Data)
		} else {
			s.local.DispatchToGuild(payload.GuildID, payload.Event, payload.Data)
		}
	})
	if err != nil {
		return fmt.Errorf("subscribe guild events: %w", err)
	}
	s.subs = append(s.subs, guildSub)

	// Subscribe to all user events: valhalla.user.*
	userSub, err := s.nc.Subscribe("valhalla.user.*", func(msg *nats.Msg) {
		var payload EventPayload
		if err := json.Unmarshal(msg.Data, &payload); err != nil {
			log.Error().Err(err).Msg("[NATS] Failed to unmarshal user event")
			return
		}

		s.local.DispatchToUser(payload.UserID, payload.Event, payload.Data)
	})
	if err != nil {
		return fmt.Errorf("subscribe user events: %w", err)
	}
	s.subs = append(s.subs, userSub)

	log.Info().Int("subscriptions", len(s.subs)).Msg("[NATS] Subscribed to event subjects")
	return nil
}

// Close unsubscribes from all subjects.
func (s *NATSSubscriber) Close() {
	for _, sub := range s.subs {
		sub.Unsubscribe()
	}
}

// GetConnection returns the underlying NATS connection (for sharing with dispatcher).
func GetConnection(url string) (*nats.Conn, error) {
	nc, err := nats.Connect(url,
		nats.RetryOnFailedConnect(true),
		nats.MaxReconnects(-1),
		nats.DisconnectErrHandler(func(_ *nats.Conn, err error) {
			if err != nil {
				log.Warn().Err(err).Msg("[NATS] Disconnected")
			}
		}),
		nats.ReconnectHandler(func(c *nats.Conn) {
			log.Info().Str("url", c.ConnectedUrl()).Msg("[NATS] Reconnected")
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("nats connect: %w", err)
	}
	log.Info().Str("url", strings.Split(url, "@")[len(strings.Split(url, "@"))-1]).Msg("[NATS] Connected")
	return nc, nil
}
