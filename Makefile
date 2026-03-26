.PHONY: all build run-api run-gateway migrate-up migrate-down dev dev-down test lint clean

# Variables
BINARY_API=bin/api
BINARY_GATEWAY=bin/gateway
BINARY_MIGRATE=bin/migrate

all: build

# Build
build:
	go build -o $(BINARY_API) ./cmd/api
	go build -o $(BINARY_GATEWAY) ./cmd/gateway
	go build -o $(BINARY_MIGRATE) ./cmd/migrate

build-api:
	go build -o $(BINARY_API) ./cmd/api

build-gateway:
	go build -o $(BINARY_GATEWAY) ./cmd/gateway

# Run
run-api: build-api
	./$(BINARY_API)

run-gateway: build-gateway
	./$(BINARY_GATEWAY)

# Database migrations
migrate-up:
	go run ./cmd/migrate -direction up

migrate-down:
	go run ./cmd/migrate -direction down -steps 1

migrate-create:
	@read -p "Migration name: " name; \
	migrate create -ext sql -dir migrations -seq $$name

# Development (Docker Compose)
dev:
	docker compose -f deployments/docker-compose.yml up -d

dev-down:
	docker compose -f deployments/docker-compose.yml down

dev-logs:
	docker compose -f deployments/docker-compose.yml logs -f

# Test
test:
	go test ./... -v -race -count=1

test-coverage:
	go test ./... -coverprofile=coverage.out
	go tool cover -html=coverage.out -o coverage.html

# Lint
lint:
	golangci-lint run ./...

# Generate (sqlc etc.)
generate:
	go generate ./...

# Clean
clean:
	rm -rf bin/
	rm -f coverage.out coverage.html
