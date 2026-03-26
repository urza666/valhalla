package config

import (
	"time"

	"github.com/kelseyhightower/envconfig"
)

type Config struct {
	// Server
	APIPort     int    `envconfig:"API_PORT" default:"8080"`
	GatewayPort int    `envconfig:"GATEWAY_PORT" default:"8081"`
	APIHost     string `envconfig:"API_HOST" default:"0.0.0.0"`

	// Database
	DatabaseURL string `envconfig:"DATABASE_URL" required:"true"`

	// Redis
	RedisURL string `envconfig:"REDIS_URL" default:"redis://localhost:6379/0"`

	// NATS
	NatsURL string `envconfig:"NATS_URL" default:"nats://localhost:4222"`

	// Auth
	TokenSecret string        `envconfig:"TOKEN_SECRET" required:"true"`
	TokenTTL    time.Duration `envconfig:"TOKEN_TTL" default:"168h"`

	// Snowflake
	SnowflakeWorkerID  int64 `envconfig:"SNOWFLAKE_WORKER_ID" default:"0"`
	SnowflakeProcessID int64 `envconfig:"SNOWFLAKE_PROCESS_ID" default:"0"`

	// Storage
	StorageEndpoint  string `envconfig:"STORAGE_ENDPOINT" default:"localhost:9000"`
	StorageAccessKey string `envconfig:"STORAGE_ACCESS_KEY" default:"minioadmin"`
	StorageSecretKey string `envconfig:"STORAGE_SECRET_KEY" default:"minioadmin"`
	StorageBucket    string `envconfig:"STORAGE_BUCKET" default:"valhalla-assets"`
	StorageUseSSL    bool   `envconfig:"STORAGE_USE_SSL" default:"false"`

	// Search
	MeiliURL    string `envconfig:"MEILI_URL" default:"http://localhost:7700"`
	MeiliAPIKey string `envconfig:"MEILI_API_KEY" default:""`

	// LiveKit (Voice/Video)
	LiveKitHost      string `envconfig:"LIVEKIT_HOST" default:"http://localhost:7880"`
	LiveKitAPIKey    string `envconfig:"LIVEKIT_API_KEY" default:"devkey"`
	LiveKitAPISecret string `envconfig:"LIVEKIT_API_SECRET" default:"devsecret"`

	// SSO
	SSOBaseURL string `envconfig:"SSO_BASE_URL" default:"http://localhost:8080"` // Public base URL for SSO callbacks
	SSOFrontendURL string `envconfig:"SSO_FRONTEND_URL" default:"http://localhost:5173"` // Frontend redirect after SSO login

	// CORS / WebSocket
	AllowedOrigins string `envconfig:"ALLOWED_ORIGINS" default:"http://localhost:5173,http://localhost:3000"`

	// Logging
	LogLevel  string `envconfig:"LOG_LEVEL" default:"debug"`
	LogFormat string `envconfig:"LOG_FORMAT" default:"console"`
}

func Load() (*Config, error) {
	var cfg Config
	if err := envconfig.Process("", &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}
