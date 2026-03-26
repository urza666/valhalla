type EventHandler = (data: unknown) => void;

const OP_DISPATCH = 0;
const OP_HEARTBEAT = 1;
const OP_IDENTIFY = 2;
const OP_RESUME = 6;
const OP_HELLO = 10;
const OP_HEARTBEAT_ACK = 11;

export class GatewaySocket {
  private ws: WebSocket | null = null;
  private heartbeatInterval: number | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private sequence: number | null = null;
  private sessionId: string | null = null;
  private token: string;
  private listeners = new Map<string, Set<EventHandler>>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 15;
  // @ts-ignore — used in scheduleReconnect
  private maxReconnectDelay = 30000;
  private canResume = false;
  // @ts-ignore — used in connect/disconnect
  private intentionalClose = false;
  // @ts-ignore — used in disconnect/scheduleReconnect
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(token: string) {
    this.token = token;
  }

  connect() {
    this.intentionalClose = false;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log('[Gateway] Connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      this.handlePayload(payload);
    };

    this.ws.onclose = (event) => {
      console.log('[Gateway] Disconnected', event.code, event.reason);
      this.cleanup();

      // Don't resume on intentional disconnect (code 1000) or auth failure (4004)
      if (event.code === 1000 || event.code === 4004) {
        this.canResume = false;
      }

      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('[Gateway] Error:', error);
    };
  }

  disconnect() {
    this.intentionalClose = true;
    this.canResume = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close(1000, 'Client disconnect');
    this.cleanup();
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[Gateway] Max reconnect attempts reached');
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    const jitter = Math.random() * 1000;
    console.log(`[Gateway] Reconnecting in ${Math.round(delay + jitter)}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay + jitter);
  }

  on(event: string, handler: EventHandler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.listeners.get(event)?.delete(handler);
  }

  private handlePayload(payload: { op: number; d?: unknown; s?: number; t?: string }) {
    if (payload.s !== undefined && payload.s !== null) {
      this.sequence = payload.s;
    }

    switch (payload.op) {
      case OP_HELLO:
        this.handleHello(payload.d as { heartbeat_interval: number });
        break;
      case OP_HEARTBEAT_ACK:
        break;
      case OP_DISPATCH:
        this.handleDispatch(payload.t!, payload.d);
        break;
    }
  }

  private handleHello(data: { heartbeat_interval: number }) {
    this.heartbeatInterval = data.heartbeat_interval;

    // Send first heartbeat after random jitter
    const jitter = Math.random() * this.heartbeatInterval;
    setTimeout(() => {
      this.sendHeartbeat();
      this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), this.heartbeatInterval!);
    }, jitter);

    // Try to resume if we have a session, otherwise identify fresh
    if (this.canResume && this.sessionId && this.sequence !== null) {
      console.log('[Gateway] Attempting resume, session:', this.sessionId, 'seq:', this.sequence);
      this.send({
        op: OP_RESUME,
        d: {
          token: this.token,
          session_id: this.sessionId,
          seq: this.sequence,
        },
      });
    } else {
      this.send({
        op: OP_IDENTIFY,
        d: {
          token: this.token,
          properties: {
            os: navigator.platform,
            browser: 'valhalla-web',
          },
        },
      });
    }
  }

  private handleDispatch(eventName: string, data: unknown) {
    if (eventName === 'READY') {
      const ready = data as { session_id: string; user: unknown; guilds: unknown[] };
      this.sessionId = ready.session_id;
      this.canResume = true;
      console.log('[Gateway] Ready, session:', this.sessionId);
    }

    if (eventName === 'RESUMED') {
      console.log('[Gateway] Session resumed successfully');
    }

    // Emit to listeners
    const handlers = this.listeners.get(eventName);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }

    // Also emit wildcard
    const wildcardHandlers = this.listeners.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach((handler) => handler({ t: eventName, d: data }));
    }
  }

  private sendHeartbeat() {
    this.send({ op: OP_HEARTBEAT, d: this.sequence });
  }

  private send(payload: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private cleanup() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
