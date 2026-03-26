.PHONY: all setup up down logs build run-api run-gateway migrate-up migrate-down test lint clean check check-backend check-frontend

# ─── Docker (recommended way to run) ─────────────────────

setup: ## First-time setup: creates .env, builds, and starts everything
	./setup.sh

up: ## Start all services
	docker compose up -d

down: ## Stop all services
	docker compose down

down-clean: ## Stop all services and delete volumes (DESTRUCTIVE)
	docker compose down -v

logs: ## Tail logs from all services
	docker compose logs -f

logs-api: ## Tail API logs only
	docker compose logs -f api

ps: ## Show service status
	docker compose ps

rebuild: ## Rebuild and restart
	docker compose build
	docker compose up -d

# ─── Local Development (without Docker for API) ──────────

BINARY_API=bin/api
BINARY_GATEWAY=bin/gateway
BINARY_MIGRATE=bin/migrate

all: build

build: ## Build Go binaries locally
	go build -o $(BINARY_API) ./cmd/api
	go build -o $(BINARY_GATEWAY) ./cmd/gateway
	go build -o $(BINARY_MIGRATE) ./cmd/migrate

build-api:
	go build -o $(BINARY_API) ./cmd/api

run-api: build-api ## Build and run API locally
	./$(BINARY_API)

run-gateway: ## Build and run Gateway locally
	go build -o $(BINARY_GATEWAY) ./cmd/gateway
	./$(BINARY_GATEWAY)

# ─── Database ────────────────────────────────────────────

migrate-up: ## Run all pending migrations
	go run ./cmd/migrate -direction up

migrate-down: ## Rollback last migration
	go run ./cmd/migrate -direction down -steps 1

migrate-create: ## Create a new migration file
	@read -p "Migration name: " name; \
	migrate create -ext sql -dir migrations -seq $$name

# ─── Dev Infra (just databases, no app containers) ───────

dev-infra: ## Start only infrastructure (PG, Redis, NATS, MinIO, Meilisearch, LiveKit)
	docker compose up -d postgres redis nats livekit minio minio-init meilisearch

dev-infra-down: ## Stop infrastructure
	docker compose down

# ─── Testing ─────────────────────────────────────────────

test: ## Run all tests
	go test ./... -v -race -count=1

test-coverage: ## Run tests with coverage report
	go test ./... -coverprofile=coverage.out
	go tool cover -html=coverage.out -o coverage.html

# ─── Quality ─────────────────────────────────────────────

lint: ## Run linter
	golangci-lint run ./...

lint-frontend: ## Run frontend typecheck (and eslint if configured)
	cd web && npx tsc --noEmit
	@if [ -f web/eslint.config.js ] || [ -f web/.eslintrc.json ] || [ -f web/.eslintrc.js ]; then \
		cd web && npx eslint src/; \
	else \
		echo "No ESLint config — skipping (add web/eslint.config.js to enable)"; \
	fi

test-frontend: ## Run frontend tests (Vitest)
	cd web && npm test

security-go: ## Check Go dependencies for issues
	go mod verify
	@command -v govulncheck >/dev/null 2>&1 && govulncheck ./... || echo "govulncheck not installed — run: go install golang.org/x/vuln/cmd/govulncheck@latest"

security-frontend: ## Audit frontend dependencies
	cd web && npm audit --omit=dev || true

check-backend: ## Run all backend quality gates
	@echo "══ go vet ══"
	go vet ./...
	@echo "══ golangci-lint ══"
	golangci-lint run ./...
	@echo "══ go build ══"
	go build ./...
	@echo "══ go test (race) ══"
	go test -race -count=1 -timeout 120s ./...
	@echo "══ go mod verify ══"
	go mod verify

check-frontend: ## Run all frontend quality gates
	@echo "══ npm ci ══"
	cd web && npm ci
	@echo "══ typecheck ══"
	cd web && npx tsc --noEmit
	@echo "══ vitest ══"
	cd web && npm test
	@echo "══ npm audit ══"
	cd web && npm audit --omit=dev || true

check: check-backend check-frontend ## Run ALL quality gates (mirrors CI)
	@echo ""
	@echo "✓ All quality gates passed"

generate: ## Run code generators
	go generate ./...

# ─── Clean ───────────────────────────────────────────────

clean: ## Remove build artifacts
	rm -rf bin/
	rm -f coverage.out coverage.html

# ─── Help ────────────────────────────────────────────────

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
