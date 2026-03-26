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
  createGuild: (name: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  guilds: [],
  selectedGuildId: null,
  channels: new Map(),
  selectedChannelId: null,
  messages: new Map(),

  loadGuilds: async () => {
    const guilds = await api.getMyGuilds();
    set({ guilds });
  },

  selectGuild: async (guildId) => {
    set({ selectedGuildId: guildId, selectedChannelId: null });

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
  },

  selectChannel: async (channelId) => {
    set({ selectedChannelId: channelId });

    if (!get().messages.has(channelId)) {
      await get().loadMessages(channelId);
    }
  },

  loadMessages: async (channelId) => {
    const msgs = await api.getMessages(channelId);
    set((state) => {
      const newMessages = new Map(state.messages);
      newMessages.set(channelId, msgs.reverse()); // API returns newest first
      return { messages: newMessages };
    });
  },

  addMessage: (message) => {
    set((state) => {
      const newMessages = new Map(state.messages);
      const channelMsgs = newMessages.get(message.channel_id) || [];
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

  createGuild: async (name) => {
    const res = await api.createGuild(name);
    set((state) => ({ guilds: [...state.guilds, res.guild] }));
    get().selectGuild(res.guild.id);
  },
}));
