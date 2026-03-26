package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/valhalla-chat/valhalla/internal/auth"
	"github.com/valhalla-chat/valhalla/internal/config"
	"github.com/valhalla-chat/valhalla/internal/eventbus"
	"github.com/valhalla-chat/valhalla/internal/gateway"
	"github.com/valhalla-chat/valhalla/internal/presence"
	"github.com/valhalla-chat/valhalla/pkg/snowflake"
)

func main() {
	// Logging
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	// Config
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("failed to load config")
	}

	// Database (for auth token validation)
	dbPool, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to connect to database")
	}
	defer dbPool.Close()

	if err := dbPool.Ping(context.Background()); err != nil {
		log.Fatal().Err(err).Msg("failed to ping database")
	}
	log.Info().Msg("connected to PostgreSQL")

	// Snowflake ID generator
	idGen := snowflake.NewGenerator(cfg.SnowflakeWorkerID, cfg.SnowflakeProcessID)

	// Auth service (for WebSocket token validation)
	authRepo := auth.NewPostgresRepository(dbPool)
	authService := auth.NewService(authRepo, idGen, cfg.TokenTTL)
	authService.SetDB(dbPool)

	// Gateway server
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	resumeURL := fmt.Sprintf("ws://%s:%d/ws", cfg.APIHost, cfg.GatewayPort)
	gateway.SetAllowedOrigins(cfg.AllowedOrigins)
	gwServer := gateway.NewServer(ctx, authService, idGen, resumeURL)
	go gwServer.StartHeartbeatChecker()

	// Presence tracking (online/idle/dnd/offline)
	presenceService := presence.NewService()
	gwServer.OnUserOnline = func(userID int64) {
		presenceService.SetOnline(userID)
	}
	gwServer.OnUserOffline = func(userID int64) {
		presenceService.SetOffline(userID)
	}

	// NATS event bus — subscribe to events published by the API process
	natsConn, natsErr := eventbus.GetConnection(cfg.NatsURL)
	if natsErr != nil {
		log.Fatal().Err(natsErr).Msg("NATS is required for standalone gateway mode")
	}
	defer natsConn.Close()

	sub := eventbus.NewNATSSubscriber(natsConn, gwServer)
	if err := sub.SubscribeAll(); err != nil {
		log.Fatal().Err(err).Msg("failed to subscribe to NATS events")
	}
	defer sub.Close()
	log.Info().Msg("subscribed to NATS event bus")

	// HTTP mux for WebSocket endpoint + health check
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", gwServer.HandleWebSocket)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, `{"status":"ok","sessions":%d}`, gwServer.SessionCount())
	})

	addr := fmt.Sprintf("%s:%d", cfg.APIHost, cfg.GatewayPort)
	srv := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start serving
	go func() {
		log.Info().Str("addr", addr).Msg("Valhalla Gateway starting (standalone)")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("gateway server failed")
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("shutting down gateway (10s grace period)...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	// 1. Stop accepting new connections
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error().Err(err).Msg("gateway forced to shutdown")
	}

	// 2. Cancel application context (stops heartbeat checker)
	cancel()

	// 3. NATS + DB connections closed via deferred calls
	log.Info().Msg("gateway stopped gracefully")
}
