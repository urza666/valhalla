import { create } from 'zustand';
import { api, User } from '../api/client';
import { GatewaySocket } from '../gateway/socket';

interface AuthState {
  user: User | null;
  token: string | null;
  gateway: GatewaySocket | null;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  restore: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  gateway: null,
  isLoading: true,

  login: async (email, password) => {
    const res = await api.login(email, password);
    api.setToken(res.token);

    const gw = new GatewaySocket(res.token);
    gw.connect();

    set({ user: res.user, token: res.token, gateway: gw });
  },

  register: async (username, email, password) => {
    const res = await api.register(username, email, password);
    api.setToken(res.token);

    const gw = new GatewaySocket(res.token);
    gw.connect();

    set({ user: res.user, token: res.token, gateway: gw });
  },

  logout: () => {
    const { gateway } = get();
    gateway?.disconnect();
    api.logout().catch(() => {});
    api.setToken(null);
    set({ user: null, token: null, gateway: null });
  },

  restore: async () => {
    const token = api.getToken();
    if (!token) {
      set({ isLoading: false });
      return;
    }

    try {
      api.setToken(token);
      const user = await api.getMe();

      const gw = new GatewaySocket(token);
      gw.connect();

      set({ user, token, gateway: gw, isLoading: false });
    } catch {
      api.setToken(null);
      set({ isLoading: false });
    }
  },
}));
