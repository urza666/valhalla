import { create } from 'zustand';

interface UnreadState {
  // channelId → unread count
  unreadCounts: Map<string, number>;
  // channelId → last read message ID
  lastRead: Map<string, string>;

  markRead: (channelId: string, messageId: string) => void;
  incrementUnread: (channelId: string) => void;
  getUnread: (channelId: string) => number;
}

export const useUnreadStore = create<UnreadState>((set, get) => ({
  unreadCounts: new Map(),
  lastRead: new Map(),

  markRead: (channelId, messageId) => {
    set((state) => {
      const newCounts = new Map(state.unreadCounts);
      const newLastRead = new Map(state.lastRead);
      newCounts.set(channelId, 0);
      newLastRead.set(channelId, messageId);
      return { unreadCounts: newCounts, lastRead: newLastRead };
    });
  },

  incrementUnread: (channelId) => {
    set((state) => {
      const newCounts = new Map(state.unreadCounts);
      newCounts.set(channelId, (newCounts.get(channelId) || 0) + 1);
      return { unreadCounts: newCounts };
    });
  },

  getUnread: (channelId) => {
    return get().unreadCounts.get(channelId) || 0;
  },
}));
