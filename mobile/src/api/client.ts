import * as SecureStore from 'expo-secure-store';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

class MobileAPIClient {
  private token: string | null = null;

  async setToken(token: string | null) {
    this.token = token;
    if (token) {
      await SecureStore.setItemAsync('auth_token', token);
    } else {
      await SecureStore.deleteItemAsync('auth_token');
    }
  }

  async getToken(): Promise<string | null> {
    if (!this.token) {
      this.token = await SecureStore.getItemAsync('auth_token');
    }
    return this.token;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) return undefined as T;
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data as T;
  }

  login(email: string, password: string) {
    return this.request<{ token: string; user: any }>('POST', '/auth/login', { email, password });
  }

  register(username: string, email: string, password: string) {
    return this.request<{ token: string; user: any }>('POST', '/auth/register', { username, email, password });
  }

  getMe() {
    return this.request<any>('GET', '/users/@me');
  }

  getMyGuilds() {
    return this.request<any[]>('GET', '/users/@me/guilds');
  }

  getGuildChannels(guildId: string) {
    return this.request<any[]>('GET', `/guilds/${guildId}/channels`);
  }

  getMessages(channelId: string, before?: string) {
    const params = new URLSearchParams({ limit: '50' });
    if (before) params.set('before', before);
    return this.request<any[]>('GET', `/channels/${channelId}/messages?${params}`);
  }

  sendMessage(channelId: string, content: string) {
    return this.request<any>('POST', `/channels/${channelId}/messages`, { content });
  }

  joinVoice(channelId: string, guildId: string) {
    return this.request<any>('POST', `/channels/${channelId}/voice/join`, { guild_id: guildId });
  }

  leaveVoice(channelId: string) {
    return this.request<void>('POST', `/channels/${channelId}/voice/leave`);
  }
}

export const api = new MobileAPIClient();
