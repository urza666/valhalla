package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/valhalla-chat/valhalla/internal/auth"
	"github.com/valhalla-chat/valhalla/internal/channel"
	"github.com/valhalla-chat/valhalla/internal/config"
	"github.com/valhalla-chat/valhalla/internal/eventbus"
	"github.com/valhalla-chat/valhalla/pkg/events"
	"github.com/valhalla-chat/valhalla/internal/dm"
	"github.com/valhalla-chat/valhalla/internal/gateway"
	"github.com/valhalla-chat/valhalla/internal/guild"
	"github.com/valhalla-chat/valhalla/internal/message"
	"github.com/valhalla-chat/valhalla/internal/bot"
	"github.com/valhalla-chat/valhalla/internal/kanban"
	"github.com/valhalla-chat/valhalla/internal/poll"
	"github.com/valhalla-chat/valhalla/internal/search"
	"github.com/valhalla-chat/valhalla/internal/user"
	"github.com/valhalla-chat/valhalla/internal/thread"
	"github.com/valhalla-chat/valhalla/internal/voice"
	"github.com/valhalla-chat/valhalla/internal/wiki"
	"github.com/valhalla-chat/valhalla/pkg/metrics"
	"github.com/valhalla-chat/valhalla/pkg/middleware"
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

	// Database
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

	// Gateway server (embedded in API process for MVP — split later)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	authRepo := auth.NewPostgresRepository(dbPool)
	authService := auth.NewService(authRepo, idGen, cfg.TokenTTL)
	authService.SetDB(dbPool)
	authHandler := auth.NewHandler(authService)

	resumeURL := fmt.Sprintf("ws://%s:%d/ws", cfg.APIHost, cfg.GatewayPort)
	gateway.SetAllowedOrigins(cfg.AllowedOrigins)
	gwServer := gateway.NewServer(ctx, authService, idGen, resumeURL)
	go gwServer.StartHeartbeatChecker()

	// NATS event bus — enables horizontal scaling of API + Gateway
	var dispatcher events.EventDispatcher = gwServer // Default: local-only dispatch
	natsConn, natsErr := eventbus.GetConnection(cfg.NatsURL)
	if natsErr != nil {
		log.Warn().Err(natsErr).Msg("NATS not available, using local-only event dispatch")
	} else {
		defer natsConn.Close()
		// Handlers publish to NATS, Gateway subscribes from NATS
		dispatcher = eventbus.NewCompositeDispatcher(natsConn, gwServer)
		sub := eventbus.NewNATSSubscriber(natsConn, gwServer)
		if err := sub.SubscribeAll(); err != nil {
			log.Error().Err(err).Msg("Failed to subscribe to NATS events")
		} else {
			defer sub.Close()
		}
	}

	// Domain services
	guildRepo := guild.NewRepository(dbPool)
	guildService := guild.NewService(guildRepo, idGen)
	guildHandler := guild.NewHandler(guildService)

	channelRepo := channel.NewRepository(dbPool)
	channelHandler := channel.NewHandler(channelRepo, idGen)

	messageRepo := message.NewRepository(dbPool)
	messageHandler := message.NewHandler(messageRepo, idGen, dispatcher)

	userService := user.NewService(dbPool)
	userHandler := user.NewHandler(userService)

	dmService := dm.NewService(dbPool, idGen)
	dmHandler := dm.NewHandler(dmService)

	threadService := thread.NewService(dbPool, idGen)
	threadHandler := thread.NewHandler(threadService)

	searchService := search.NewService(cfg.MeiliURL, cfg.MeiliAPIKey)
	searchHandler := search.NewHandler(searchService)

	voiceService := voice.NewService(cfg.LiveKitHost, cfg.LiveKitAPIKey, cfg.LiveKitAPISecret)
	voiceHandler := voice.NewHandler(voiceService, gwServer)

	kanbanService := kanban.NewService(dbPool, idGen)
	kanbanHandler := kanban.NewHandler(kanbanService)

	wikiService := wiki.NewService(dbPool, idGen)
	wikiHandler := wiki.NewHandler(wikiService)

	pollService := poll.NewService(dbPool, idGen)
	pollHandler := poll.NewHandler(pollService)

	botService := bot.NewService(dbPool, idGen)
	_ = botService // Used for token validation, handler routes below

	// Router
	r := chi.NewRouter()

	// Global middleware
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(middleware.Logger)
	r.Use(chimw.Recoverer)
	r.Use(middleware.MaxBodySize(1 << 20)) // 1 MB max JSON body
	r.Use(middleware.CSRFProtection(strings.Split(cfg.AllowedOrigins, ",")))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:*", "https://localhost:*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Rate limiter: 50 requests per second (global)
	limiter := middleware.NewRateLimiter(50, time.Second)
	r.Use(limiter.Limit)

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"status":"ok"}`))
	})

	// WebSocket endpoint (embedded gateway for MVP)
	r.Get("/ws", gwServer.HandleWebSocket)

	// Observability endpoints (no auth required, but /metrics restricted to internal)
	r.Get("/metrics", internalOnly(metrics.Handler()))
	r.Get("/health", metrics.HealthHandler())

	// API Documentation
	r.Get("/api/docs", metrics.SwaggerUIHandler())
	r.Get("/api/docs/openapi.yaml", metrics.OpenAPISpecHandler("docs/openapi.yaml"))

	// API v1 routes
	r.Route("/api/v1", func(r chi.Router) {
		// Public routes
		r.Route("/auth", func(r chi.Router) {
			r.Post("/register", authHandler.Register)
			r.Post("/login", authHandler.Login)
			r.Post("/forgot-password", authHandler.ForgotPassword)
			r.Post("/reset-password", authHandler.ResetPassword)
		})

		// Invite preview (public)
		// r.Get("/invites/{code}", ...)

		// Protected routes
		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth(authService))

			// Auth
			r.Post("/auth/logout", authHandler.Logout)

			// Users
			r.Get("/users/@me", authHandler.Me)
			r.Patch("/users/@me", userHandler.UpdateProfile)
			r.Post("/users/@me/password", userHandler.ChangePassword)
			r.Post("/users/@me/delete", userHandler.DeleteAccount)
			r.Get("/users/@me/export", userHandler.ExportData)
			r.Get("/users/@me/sessions", userHandler.GetSessions)
			r.Delete("/users/@me/sessions", userHandler.RevokeSession)
			r.Get("/users/@me/relationships", userHandler.GetRelationships)
			r.Post("/users/@me/relationships", userHandler.SendFriendRequest)
			r.Put("/users/@me/relationships/{targetID}", userHandler.AcceptFriend)
			r.Delete("/users/@me/relationships/{targetID}", userHandler.RemoveFriend)
			r.Put("/users/@me/blocks/{targetID}", userHandler.BlockUser)
			r.Delete("/users/@me/blocks/{targetID}", userHandler.UnblockUser)
			r.Get("/users/{userID}/profile", userHandler.GetUserProfile)
			r.Get("/users/@me/guilds", guildHandler.GetUserGuilds)
			r.Get("/users/@me/channels", dmHandler.GetUserDMs)
			r.Post("/users/@me/channels", dmHandler.CreateDM)

			// Guilds
			r.Post("/guilds", guildHandler.CreateGuild)
			r.Route("/guilds/{guildID}", func(r chi.Router) {
				r.Get("/", guildHandler.GetGuild)
				r.Patch("/", guildHandler.UpdateGuild)
				r.Delete("/", guildHandler.DeleteGuild)

				// Guild channels
				r.Get("/channels", channelHandler.GetGuildChannels)
				r.Post("/channels", channelHandler.CreateChannel)

				// Guild members
				r.Get("/members", guildHandler.GetMembers)
				r.Delete("/members/{userID}", guildHandler.KickMember)

				// Guild roles
				r.Get("/roles", guildHandler.GetRoles)
				r.Post("/roles", guildHandler.CreateRole)
				r.Patch("/roles/{roleID}", guildHandler.UpdateRole)
				r.Delete("/roles/{roleID}", guildHandler.DeleteRole)

				// Guild bans
				r.Get("/bans", guildHandler.GetBans)
				r.Put("/bans/{userID}", guildHandler.BanMember)
				r.Delete("/bans/{userID}", guildHandler.UnbanMember)

				// Audit log
				r.Get("/audit-logs", guildHandler.GetAuditLog)

				// Guild search
				r.Get("/messages/search", searchHandler.SearchMessages)

				// Guild voice states
				r.Get("/voice-states", voiceHandler.GetVoiceStates)

				// Guild wiki
				r.Get("/wiki", wikiHandler.GetGuildPages)
				r.Post("/wiki", wikiHandler.CreatePage)
			})

			// Voice state
			r.Patch("/voice/state", voiceHandler.UpdateVoiceState)

			// Wiki pages
			r.Route("/wiki/{pageID}", func(r chi.Router) {
				r.Get("/", wikiHandler.GetPage)
				r.Patch("/", wikiHandler.UpdatePage)
				r.Delete("/", wikiHandler.DeletePage)
				r.Get("/revisions", wikiHandler.GetRevisions)
			})

			// Kanban boards
			r.Route("/boards/{boardID}", func(r chi.Router) {
				r.Get("/", kanbanHandler.GetBoard)
				r.Post("/buckets", kanbanHandler.CreateBucket)
				r.Post("/tasks", kanbanHandler.CreateTask)
			})

			// Kanban tasks
			r.Patch("/tasks/{taskID}", kanbanHandler.UpdateTask)
			r.Post("/tasks/{taskID}/move", kanbanHandler.MoveTask)
			r.Delete("/tasks/{taskID}", kanbanHandler.DeleteTask)

			// Polls
			r.Get("/polls/{pollID}", pollHandler.GetPoll)
			r.Put("/polls/{pollID}/options/{optionID}/vote", pollHandler.Vote)
			r.Delete("/polls/{pollID}/options/{optionID}/vote", pollHandler.Unvote)

			// Invites
			r.Post("/invites/{code}/accept", guildHandler.JoinGuild)

			// Channels
			r.Route("/channels/{channelID}", func(r chi.Router) {
				r.Get("/", channelHandler.GetChannel)
				r.Patch("/", channelHandler.UpdateChannel)
				r.Delete("/", channelHandler.DeleteChannel)

				// Messages
				r.Get("/messages", messageHandler.GetMessages)
				r.Post("/messages", messageHandler.CreateMessage)
				r.Patch("/messages/{messageID}", messageHandler.UpdateMessage)
				r.Delete("/messages/{messageID}", messageHandler.DeleteMessage)

				// Reactions
				r.Put("/messages/{messageID}/reactions/{emoji}/@me", messageHandler.AddReaction)
				r.Delete("/messages/{messageID}/reactions/{emoji}/@me", messageHandler.RemoveReaction)

				// Read state
				r.Post("/messages/{messageID}/ack", messageHandler.AckMessage)

				// Reports
				r.Post("/messages/{messageID}/report", messageHandler.ReportMessage)

				// Pinned messages
				r.Get("/pins", messageHandler.GetPinnedMessages)
				r.Put("/pins/{messageID}", messageHandler.PinMessage)
				r.Delete("/pins/{messageID}", messageHandler.UnpinMessage)

				// Typing
				r.Post("/typing", gwServer.HandleTyping)

				// Threads
				r.Get("/threads", threadHandler.GetActiveThreads)
				r.Post("/threads", threadHandler.CreateThread)

				// Voice
				r.Post("/voice/join", voiceHandler.JoinVoice)
				r.Post("/voice/leave", voiceHandler.LeaveVoice)
				r.Get("/voice/users", voiceHandler.GetChannelVoiceUsers)

				// Kanban boards per channel
				r.Get("/boards", kanbanHandler.GetChannelBoards)
				r.Post("/boards", kanbanHandler.CreateBoard)

				// Polls per channel
				r.Post("/polls", pollHandler.CreatePoll)

				// Invites
				r.Post("/invites", guildHandler.CreateInvite)

				// File uploads
				r.Post("/attachments", messageHandler.UploadAttachment)
			})
		})

		// Attachment serving (public, no auth for serving files)
		r.Get("/attachments/{filename}", messageHandler.ServeAttachment)
	})

	// Server
	addr := fmt.Sprintf("%s:%d", cfg.APIHost, cfg.APIPort)
	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	go func() {
		log.Info().Str("addr", addr).Msg("Valhalla API + Gateway starting")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("server failed")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("shutting down server...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatal().Err(err).Msg("server forced to shutdown")
	}
	log.Info().Msg("server stopped")
}

// internalOnly restricts access to localhost/private IPs (for /metrics, /debug).
func internalOnly(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ip := r.RemoteAddr
		// Allow localhost, Docker internal, and private networks
		if strings.HasPrefix(ip, "127.") || strings.HasPrefix(ip, "[::1]") ||
			strings.HasPrefix(ip, "10.") || strings.HasPrefix(ip, "172.") ||
			strings.HasPrefix(ip, "192.168.") || ip == "" {
			next.ServeHTTP(w, r)
			return
		}
		http.Error(w, "Forbidden", http.StatusForbidden)
	}
}
