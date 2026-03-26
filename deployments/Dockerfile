# ── Build Stage ──────────────────────────────────────────
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git ca-certificates

WORKDIR /app

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /bin/valhalla-api ./cmd/api
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /bin/valhalla-migrate ./cmd/migrate

# ── Web Client Build ────────────────────────────────────
FROM node:20-alpine AS web-builder

WORKDIR /web
COPY web/package.json web/package-lock.json* ./
RUN npm ci --ignore-scripts 2>/dev/null || npm install
COPY web/ .
RUN npm run build

# ── Production Image ────────────────────────────────────
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /bin/valhalla-api /app/valhalla-api
COPY --from=builder /bin/valhalla-migrate /app/valhalla-migrate
COPY --from=builder /app/migrations /app/migrations
COPY --from=web-builder /web/dist /app/web/dist

# Run migrations then start API
COPY deployments/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/app/entrypoint.sh"]
