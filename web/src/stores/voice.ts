import { create } from 'zustand';
import { api } from '../api/client';

interface VoiceState {
  guild_id: string;
  channel_id: string | null;
  user_id: string;
  self_mute: boolean;
  self_deaf: boolean;
}

interface VoiceStore {
  // State
  connected: boolean;
  channelId: string | null;
  guildId: string | null;
  selfMute: boolean;
  selfDeaf: boolean;
  lkToken: string | null;
  lkEndpoint: string | null;
  channelVoiceStates: VoiceState[];

  // Actions
  joinChannel: (guildId: string, channelId: string) => Promise<void>;
  leaveChannel: () => Promise<void>;
  toggleMute: () => Promise<void>;
  toggleDeaf: () => Promise<void>;
  updateVoiceStates: (states: VoiceState[]) => void;
  handleVoiceStateUpdate: (state: VoiceState) => void;
}

export const useVoiceStore = create<VoiceStore>((set, get) => ({
  connected: false,
  channelId: null,
  guildId: null,
  selfMute: false,
  selfDeaf: false,
  lkToken: null,
  lkEndpoint: null,
  channelVoiceStates: [],

  joinChannel: async (guildId, channelId) => {
    try {
      const res = await fetch(`/api/v1/channels/${channelId}/voice/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ guild_id: guildId }),
      });
      const data = await res.json();

      set({
        connected: true,
        channelId,
        guildId,
        selfMute: false,
        selfDeaf: false,
        lkToken: data.server.token,
        lkEndpoint: data.server.endpoint,
      });
    } catch (err) {
      console.error('Failed to join voice:', err);
    }
  },

  leaveChannel: async () => {
    const { channelId } = get();
    if (!channelId) return;

    try {
      await fetch(`/api/v1/channels/${channelId}/voice/leave`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
    } catch {
      // Best effort
    }

    set({
      connected: false,
      channelId: null,
      guildId: null,
      selfMute: false,
      selfDeaf: false,
      lkToken: null,
      lkEndpoint: null,
      channelVoiceStates: [],
    });
  },

  toggleMute: async () => {
    const newMute = !get().selfMute;
    set({ selfMute: newMute });

    await fetch('/api/v1/voice/state', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ self_mute: newMute }),
    }).catch(() => {});
  },

  toggleDeaf: async () => {
    const newDeaf = !get().selfDeaf;
    set({
      selfDeaf: newDeaf,
      selfMute: newDeaf ? true : get().selfMute, // deaf implies mute
    });

    await fetch('/api/v1/voice/state', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({ self_deaf: newDeaf }),
    }).catch(() => {});
  },

  updateVoiceStates: (states) => {
    set({ channelVoiceStates: states });
  },

  handleVoiceStateUpdate: (state) => {
    set((prev) => {
      const states = prev.channelVoiceStates.filter((s) => s.user_id !== state.user_id);
      if (state.channel_id) {
        states.push(state);
      }
      return { channelVoiceStates: states };
    });
  },
}));
