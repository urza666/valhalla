const API_BASE = '/api/v1';

class APIClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) return undefined as T;

    const data = await res.json();

    if (!res.ok) {
      throw new APIError(res.status, data.code, data.message);
    }

    return data as T;
  }

  // Auth
  register(username: string, email: string, password: string) {
    return this.request<{ token: string; user: User }>('POST', '/auth/register', { username, email, password });
  }

  login(email: string, password: string) {
    return this.request<{ token: string; user: User }>('POST', '/auth/login', { email, password });
  }

  logout() {
    return this.request<void>('POST', '/auth/logout');
  }

  getMe() {
    return this.request<User>('GET', '/users/@me');
  }

  getMyGuilds() {
    return this.request<Guild[]>('GET', '/users/@me/guilds');
  }

  getMyDMs() {
    return this.request<DMChannel[]>('GET', '/users/@me/channels');
  }

  createDM(recipientId: string) {
    return this.request<Channel>('POST', '/users/@me/channels', { recipient_id: recipientId });
  }

  // Typing
  sendTyping(channelId: string) {
    return this.request<void>('POST', `/channels/${channelId}/typing`);
  }

  // Guilds
  createGuild(name: string) {
    return this.request<{ guild: Guild; roles: Role[]; channels: Channel[] }>('POST', '/guilds', { name });
  }

  getGuild(guildId: string) {
    return this.request<Guild>('GET', `/guilds/${guildId}`);
  }

  getGuildChannels(guildId: string) {
    return this.request<Channel[]>('GET', `/guilds/${guildId}/channels`);
  }

  getGuildMembers(guildId: string) {
    return this.request<Member[]>('GET', `/guilds/${guildId}/members`);
  }

  joinGuild(code: string) {
    return this.request<{ guild: Guild; member: Member }>('POST', `/invites/${code}/accept`);
  }

  // Channels
  getChannel(channelId: string) {
    return this.request<Channel>('GET', `/channels/${channelId}`);
  }

  createChannel(guildId: string, name: string, type: number = 0) {
    return this.request<Channel>('POST', `/guilds/${guildId}/channels`, { name, type });
  }

  // Messages
  getMessages(channelId: string, before?: string, limit: number = 50) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.set('before', before);
    return this.request<Message[]>('GET', `/channels/${channelId}/messages?${params}`);
  }

  sendMessage(channelId: string, content: string, referenceId?: string) {
    return this.request<Message>('POST', `/channels/${channelId}/messages`, {
      content,
      message_reference: referenceId,
    });
  }

  editMessage(channelId: string, messageId: string, content: string) {
    return this.request<Message>('PATCH', `/channels/${channelId}/messages/${messageId}`, { content });
  }

  deleteMessage(channelId: string, messageId: string) {
    return this.request<void>('DELETE', `/channels/${channelId}/messages/${messageId}`);
  }

  addReaction(channelId: string, messageId: string, emoji: string) {
    return this.request<void>('PUT', `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`);
  }

  removeReaction(channelId: string, messageId: string, emoji: string) {
    return this.request<void>('DELETE', `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`);
  }
}

export class APIError extends Error {
  constructor(public status: number, public code: number, message: string) {
    super(message);
  }
}

// Types
export interface User {
  id: string;
  username: string;
  display_name: string | null;
  email: string;
  avatar: string | null;
  bio: string | null;
  mfa_enabled: boolean;
  verified: boolean;
}

export interface Guild {
  id: string;
  name: string;
  icon: string | null;
  owner_id: string;
  member_count?: number;
}

export interface Channel {
  id: string;
  guild_id: string | null;
  type: number;
  name: string | null;
  topic: string | null;
  position: number;
  parent_id: string | null;
  last_message_id: string | null;
}

export interface Message {
  id: string;
  channel_id: string;
  author: { id: string; username: string; display_name: string | null; avatar: string | null };
  content: string;
  timestamp: string;
  edited_timestamp: string | null;
  type: number;
  pinned: boolean;
  reactions?: { emoji: string; count: number; me: boolean }[];
  message_reference?: string;
}

export interface Member {
  user_id: string;
  guild_id: string;
  nick: string | null;
  roles: string[];
  joined_at: string;
  user?: { id: string; username: string; display_name: string | null; avatar: string | null };
}

export interface Role {
  id: string;
  guild_id: string;
  name: string;
  color: number;
  position: number;
  permissions: string;
}

export interface DMChannel {
  id: string;
  type: number;
  last_message_id: string | null;
  created_at: string;
  recipient: {
    id: string;
    username: string;
    display_name: string | null;
    avatar: string | null;
  };
}

export const api = new APIClient();
