import { create } from 'zustand';

interface SettingsState {
  // Notifications
  desktopNotifications: boolean;
  notificationSound: boolean;
  mutedGuilds: Set<string>;
  mutedChannels: Set<string>;

  // Appearance
  theme: 'dark' | 'light';
  fontSize: number;
  compactMode: boolean;

  // Actions
  toggleDesktopNotifications: () => void;
  toggleNotificationSound: () => void;
  muteGuild: (guildId: string) => void;
  unmuteGuild: (guildId: string) => void;
  muteChannel: (channelId: string) => void;
  unmuteChannel: (channelId: string) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setFontSize: (size: number) => void;
  toggleCompactMode: () => void;
  requestNotificationPermission: () => Promise<boolean>;
  sendNotification: (title: string, body: string) => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  desktopNotifications: localStorage.getItem('notif_desktop') !== 'false',
  notificationSound: localStorage.getItem('notif_sound') !== 'false',
  mutedGuilds: new Set(JSON.parse(localStorage.getItem('muted_guilds') || '[]')),
  mutedChannels: new Set(JSON.parse(localStorage.getItem('muted_channels') || '[]')),
  theme: (localStorage.getItem('theme') as 'dark' | 'light') || (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'),
  fontSize: Number(localStorage.getItem('font_size')) || 16,
  compactMode: localStorage.getItem('compact_mode') === 'true',

  toggleDesktopNotifications: () => {
    const next = !get().desktopNotifications;
    localStorage.setItem('notif_desktop', String(next));
    set({ desktopNotifications: next });
    if (next) get().requestNotificationPermission();
  },

  toggleNotificationSound: () => {
    const next = !get().notificationSound;
    localStorage.setItem('notif_sound', String(next));
    set({ notificationSound: next });
  },

  muteGuild: (guildId) => {
    const s = new Set(get().mutedGuilds);
    s.add(guildId);
    localStorage.setItem('muted_guilds', JSON.stringify([...s]));
    set({ mutedGuilds: s });
  },

  unmuteGuild: (guildId) => {
    const s = new Set(get().mutedGuilds);
    s.delete(guildId);
    localStorage.setItem('muted_guilds', JSON.stringify([...s]));
    set({ mutedGuilds: s });
  },

  muteChannel: (channelId) => {
    const s = new Set(get().mutedChannels);
    s.add(channelId);
    localStorage.setItem('muted_channels', JSON.stringify([...s]));
    set({ mutedChannels: s });
  },

  unmuteChannel: (channelId) => {
    const s = new Set(get().mutedChannels);
    s.delete(channelId);
    localStorage.setItem('muted_channels', JSON.stringify([...s]));
    set({ mutedChannels: s });
  },

  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },

  setFontSize: (size) => {
    localStorage.setItem('font_size', String(size));
    document.documentElement.style.fontSize = size + 'px';
    set({ fontSize: size });
  },

  toggleCompactMode: () => {
    const next = !get().compactMode;
    localStorage.setItem('compact_mode', String(next));
    set({ compactMode: next });
  },

  requestNotificationPermission: async () => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  },

  sendNotification: (title, body) => {
    const { desktopNotifications } = get();
    if (!desktopNotifications) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (document.hasFocus()) return; // Don't notify if tab is focused

    new Notification(title, {
      body,
      icon: '/favicon.ico',
      silent: !get().notificationSound,
    });
  },
}));
