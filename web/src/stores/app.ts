import { create } from 'zustand';
import { api, Guild, Channel, Message } from '../api/client';

interface AppState {
  // Guilds
  guilds: Guild[];
  selectedGuildId: string | null;

  // Channels
  channels: Map<string, Channel[]>; // guildId -> channels
  selectedChannelId: string | null;

  // Messages
  messages: Map<string, Message[]>; // channelId -> messages

  // Actions
  loadGuilds: () => Promise<void>;
  selectGuild: (guildId: string) => Promise<void>;
  selectChannel: (channelId: string) => Promise<void>;
  loadMessages: (channelId: string) => Promise<void>;
  addMessage: (message: Message) => void;
  updateMessage: (message: Message) => void;
  removeMessage: (channelId: string, messageId: string) => void;
  addReaction: (channelId: string, messageId: string, emoji: string, userId: string) => void;
  removeReaction: (channelId: string, messageId: string, emoji: string, userId: string) => void;
  createGuild: (name: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  guilds: [],
  selectedGuildId: null,
  channels: new Map(),
  selectedChannelId: null,
  messages: new Map(),

  loadGuilds: async () => {
    try {
      const guilds = await api.getMyGuilds();
      set({ guilds });
    } catch (err) {
      console.error('[AppStore] Failed to load guilds:', err);
      set({ guilds: [] });
    }
  },

  selectGuild: async (guildId) => {
    set({ selectedGuildId: guildId, selectedChannelId: null });

    try {
      if (!get().channels.has(guildId)) {
        const channels = await api.getGuildChannels(guildId);
        set((state) => {
          const newChannels = new Map(state.channels);
          newChannels.set(guildId, channels);
          return { channels: newChannels };
        });
      }

      // Auto-select first text channel
      const channels = get().channels.get(guildId);
      const firstText = channels?.find((c) => c.type === 0);
      if (firstText) {
        get().selectChannel(firstText.id);
      }
    } catch (err) {
      console.error('[AppStore] selectGuild failed:', err);
    }
  },

  selectChannel: async (channelId) => {
    set({ selectedChannelId: channelId });

    try {
      if (!get().messages.has(channelId)) {
        await get().loadMessages(channelId);
      }
    } catch (err) {
      console.error('[AppStore] selectChannel failed:', err);
    }
  },

  loadMessages: async (channelId) => {
    try {
      const msgs = await api.getMessages(channelId);
      set((state) => {
        const newMessages = new Map(state.messages);
        newMessages.set(channelId, [...msgs].reverse());
        return { messages: newMessages };
      });
    } catch (err) {
      console.error('[AppStore] loadMessages failed:', err);
    }
  },

  addMessage: (message) => {
    set((state) => {
      const newMessages = new Map(state.messages);
      const channelMsgs = newMessages.get(message.channel_id) || [];
      // Deduplicate: don't add if already exists (optimistic UI + WS event)
      if (channelMsgs.some((m) => m.id === message.id)) return state;
      newMessages.set(message.channel_id, [...channelMsgs, message]);
      return { messages: newMessages };
    });
  },

  updateMessage: (message) => {
    set((state) => {
      const newMessages = new Map(state.messages);
      const channelMsgs = newMessages.get(message.channel_id) || [];
      const idx = channelMsgs.findIndex((m) => m.id === message.id);
      if (idx !== -1) {
        channelMsgs[idx] = message;
        newMessages.set(message.channel_id, [...channelMsgs]);
      }
      return { messages: newMessages };
    });
  },

  removeMessage: (channelId, messageId) => {
    set((state) => {
      const newMessages = new Map(state.messages);
      const channelMsgs = newMessages.get(channelId) || [];
      newMessages.set(channelId, channelMsgs.filter((m) => m.id !== messageId));
      return { messages: newMessages };
    });
  },

  // Real-time reaction updates from WebSocket
  addReaction: (channelId, messageId, emoji, userId) => {
    set((state) => {
      const newMessages = new Map(state.messages);
      const channelMsgs = newMessages.get(channelId);
      if (!channelMsgs) return state;

      const msgIdx = channelMsgs.findIndex((m) => m.id === messageId);
      if (msgIdx === -1) return state;

      const msg = { ...channelMsgs[msgIdx] };
      const reactions = [...(msg.reactions || [])];
      // Check if this reaction is from the current user
      const currentUserId = localStorage.getItem('user_id');
      const isMe = userId === currentUserId;

      // One reaction per user: remove user's previous reaction from other emojis
      for (let i = reactions.length - 1; i >= 0; i--) {
        if (reactions[i].emoji !== emoji && reactions[i].me) {
          reactions[i] = { ...reactions[i], count: Math.max(0, reactions[i].count - 1), me: false };
          if (reactions[i].count === 0) reactions.splice(i, 1);
        }
      }

      // Add/increment the new emoji reaction
      const existing = reactions.find((r) => r.emoji === emoji);
      if (existing) {
        const idx = reactions.indexOf(existing);
        reactions[idx] = { ...existing, count: existing.count + 1, me: existing.me || isMe };
      } else {
        reactions.push({ emoji, count: 1, me: isMe });
      }

      msg.reactions = reactions;
      const updated = [...channelMsgs];
      updated[msgIdx] = msg;
      newMessages.set(channelId, updated);
      return { messages: newMessages };
    });
  },

  removeReaction: (channelId, messageId, emoji, _userId) => {
    set((state) => {
      const newMessages = new Map(state.messages);
      const channelMsgs = newMessages.get(channelId);
      if (!channelMsgs) return state;

      const msgIdx = channelMsgs.findIndex((m) => m.id === messageId);
      if (msgIdx === -1) return state;

      const msg = { ...channelMsgs[msgIdx] };
      let reactions = [...(msg.reactions || [])];

      const existing = reactions.find((r) => r.emoji === emoji);
      if (existing) {
        const newCount = existing.count - 1;
        if (newCount <= 0) {
          reactions = reactions.filter((r) => r.emoji !== emoji);
        } else {
          reactions = reactions.map((r) =>
            r.emoji === emoji ? { ...r, count: newCount, me: false } : r
          );
        }
      }

      msg.reactions = reactions;
      const updated = [...channelMsgs];
      updated[msgIdx] = msg;
      newMessages.set(channelId, updated);
      return { messages: newMessages };
    });
  },

  createGuild: async (name) => {
    const res = await api.createGuild(name);
    set((state) => ({ guilds: [...state.guilds, res.guild] }));
    get().selectGuild(res.guild.id);
  },
}));
