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
	"github.com/valhalla-chat/valhalla/internal/gateway"
	"github.com/valhalla-chat/valhalla/pkg/snowflake"
)

func main() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

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

	// Snowflake
	idGen := snowflake.NewGenerator(cfg.SnowflakeWorkerID, cfg.SnowflakeProcessID)

	// Auth service (for token validation in gateway)
	authRepo := auth.NewPostgresRepository(dbPool)
	authService := auth.NewService(authRepo, idGen, cfg.TokenTTL)

	// Gateway server
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	resumeURL := fmt.Sprintf("ws://%s:%d/ws", cfg.APIHost, cfg.GatewayPort)
	gwServer := gateway.NewServer(ctx, authService, idGen, resumeURL)

	// Start heartbeat checker
	go gwServer.StartHeartbeatChecker()

	// HTTP mux for WebSocket endpoint
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
	}

	go func() {
		log.Info().Str("addr", addr).Msg("Gateway server starting")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("gateway server failed")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("shutting down gateway...")
	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatal().Err(err).Msg("gateway forced to shutdown")
	}
	log.Info().Msg("gateway stopped")
}
