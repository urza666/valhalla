# ═══════════════════════════════════════════════════════════
# Valhalla API — Multi-Stage Build
# ═══════════════════════════════════════════════════════════

# ── Stage 1: Go Build ─────────────────────────────────────
FROM golang:1.22-alpine AS go-builder

RUN apk add --no-cache git ca-certificates tzdata

WORKDIR /src

# Cache Go dependencies separately
COPY go.mod go.sum ./
RUN go mod download

# Copy source and compile
COPY cmd/ cmd/
COPY internal/ internal/
COPY pkg/ pkg/

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -o /bin/valhalla-api ./cmd/api

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -o /bin/valhalla-gateway ./cmd/gateway

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-s -w" -o /bin/valhalla-migrate ./cmd/migrate

# ── Stage 2: Production Runtime ───────────────────────────
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata curl

RUN adduser -D -u 1000 valhalla

WORKDIR /app

COPY --from=go-builder /bin/valhalla-api /app/valhalla-api
COPY --from=go-builder /bin/valhalla-gateway /app/valhalla-gateway
COPY --from=go-builder /bin/valhalla-migrate /app/valhalla-migrate
COPY migrations/ /app/migrations/
COPY deployments/entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh && chown -R valhalla:valhalla /app

USER valhalla

EXPOSE 8080 8081

HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
