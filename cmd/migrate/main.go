package main

import (
	"flag"
	"os"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	direction := flag.String("direction", "up", "Migration direction: up or down")
	steps := flag.Int("steps", 0, "Number of steps (0 = all)")
	flag.Parse()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal().Msg("DATABASE_URL is required")
	}

	m, err := migrate.New("file://migrations", dbURL)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to create migrator")
	}
	defer m.Close()

	switch *direction {
	case "up":
		if *steps > 0 {
			err = m.Steps(*steps)
		} else {
			err = m.Up()
		}
	case "down":
		if *steps > 0 {
			err = m.Steps(-*steps)
		} else {
			err = m.Down()
		}
	default:
		log.Fatal().Str("direction", *direction).Msg("invalid direction, use 'up' or 'down'")
	}

	if err != nil && err != migrate.ErrNoChange {
		log.Fatal().Err(err).Str("direction", *direction).Msg("migration failed")
	}

	version, dirty, _ := m.Version()
	log.Info().
		Str("direction", *direction).
		Uint("version", version).
		Bool("dirty", dirty).
		Msg("migration complete")
}
