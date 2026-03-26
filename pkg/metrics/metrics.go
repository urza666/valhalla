package metrics

import (
	"fmt"
	"net/http"
	"runtime"
	"sync/atomic"
	"time"
)

// Simple Prometheus-compatible metrics without external dependencies.
// Can be replaced with prometheus/client_golang when needed.

var (
	httpRequestsTotal  atomic.Int64
	httpErrorsTotal    atomic.Int64
	wsSessionsActive   atomic.Int64
	wsSessionsTotal    atomic.Int64
	messagesCreated    atomic.Int64
	startTime          = time.Now()
)

// IncrHTTPRequests increments the HTTP request counter.
func IncrHTTPRequests() { httpRequestsTotal.Add(1) }

// IncrHTTPErrors increments the HTTP error counter.
func IncrHTTPErrors() { httpErrorsTotal.Add(1) }

// IncrWSSessions increments the active WS session counter.
func IncrWSSessions() { wsSessionsActive.Add(1); wsSessionsTotal.Add(1) }

// DecrWSSessions decrements the active WS session counter.
func DecrWSSessions() { wsSessionsActive.Add(-1) }

// IncrMessages increments the messages created counter.
func IncrMessages() { messagesCreated.Add(1) }

// Handler serves Prometheus-format metrics at /metrics.
func Handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var mem runtime.MemStats
		runtime.ReadMemStats(&mem)

		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")

		fmt.Fprintf(w, "# HELP valhalla_uptime_seconds Time since server start.\n")
		fmt.Fprintf(w, "# TYPE valhalla_uptime_seconds gauge\n")
		fmt.Fprintf(w, "valhalla_uptime_seconds %.0f\n\n", time.Since(startTime).Seconds())

		fmt.Fprintf(w, "# HELP valhalla_http_requests_total Total HTTP requests.\n")
		fmt.Fprintf(w, "# TYPE valhalla_http_requests_total counter\n")
		fmt.Fprintf(w, "valhalla_http_requests_total %d\n\n", httpRequestsTotal.Load())

		fmt.Fprintf(w, "# HELP valhalla_http_errors_total Total HTTP error responses.\n")
		fmt.Fprintf(w, "# TYPE valhalla_http_errors_total counter\n")
		fmt.Fprintf(w, "valhalla_http_errors_total %d\n\n", httpErrorsTotal.Load())

		fmt.Fprintf(w, "# HELP valhalla_ws_sessions_active Currently active WebSocket sessions.\n")
		fmt.Fprintf(w, "# TYPE valhalla_ws_sessions_active gauge\n")
		fmt.Fprintf(w, "valhalla_ws_sessions_active %d\n\n", wsSessionsActive.Load())

		fmt.Fprintf(w, "# HELP valhalla_ws_sessions_total Total WebSocket sessions since start.\n")
		fmt.Fprintf(w, "# TYPE valhalla_ws_sessions_total counter\n")
		fmt.Fprintf(w, "valhalla_ws_sessions_total %d\n\n", wsSessionsTotal.Load())

		fmt.Fprintf(w, "# HELP valhalla_messages_created_total Total messages created.\n")
		fmt.Fprintf(w, "# TYPE valhalla_messages_created_total counter\n")
		fmt.Fprintf(w, "valhalla_messages_created_total %d\n\n", messagesCreated.Load())

		fmt.Fprintf(w, "# HELP valhalla_goroutines Number of active goroutines.\n")
		fmt.Fprintf(w, "# TYPE valhalla_goroutines gauge\n")
		fmt.Fprintf(w, "valhalla_goroutines %d\n\n", runtime.NumGoroutine())

		fmt.Fprintf(w, "# HELP valhalla_memory_alloc_bytes Memory currently allocated.\n")
		fmt.Fprintf(w, "# TYPE valhalla_memory_alloc_bytes gauge\n")
		fmt.Fprintf(w, "valhalla_memory_alloc_bytes %d\n\n", mem.Alloc)

		fmt.Fprintf(w, "# HELP valhalla_memory_sys_bytes Total memory obtained from OS.\n")
		fmt.Fprintf(w, "# TYPE valhalla_memory_sys_bytes gauge\n")
		fmt.Fprintf(w, "valhalla_memory_sys_bytes %d\n\n", mem.Sys)

		fmt.Fprintf(w, "# HELP valhalla_gc_total Total garbage collections.\n")
		fmt.Fprintf(w, "# TYPE valhalla_gc_total counter\n")
		fmt.Fprintf(w, "valhalla_gc_total %d\n", mem.NumGC)
	}
}

// HealthHandler returns a simple health check response.
func HealthHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"healthy","uptime_seconds":%.0f,"goroutines":%d}`,
			time.Since(startTime).Seconds(), runtime.NumGoroutine())
	}
}
