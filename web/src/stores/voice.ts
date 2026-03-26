import { create } from 'zustand';
import { api } from '../api/client';

interface VoiceState {
  guild_id: string;
  channel_id: string | null;
  user_id: string;
  self_mute: boolean;
  self_deaf: boolean;
  self_video?: boolean;
  self_stream?: boolean;
}

interface VoiceStore {
  // State
  connected: boolean;
  channelId: string | null;
  guildId: string | null;
  selfMute: boolean;
  selfDeaf: boolean;
  selfVideo: boolean;
  selfStream: boolean;
  lkToken: string | null;
  lkEndpoint: string | null;
  lkRoom: any | null; // LiveKit Room instance
  channelVoiceStates: VoiceState[];

  // Audio/Video device settings
  audioInputDevice: string;
  audioOutputDevice: string;
  videoInputDevice: string;
  inputVolume: number;
  outputVolume: number;

  // Actions
  joinChannel: (guildId: string, channelId: string) => Promise<void>;
  leaveChannel: () => Promise<void>;
  setLkRoom: (room: any | null) => void;
  toggleMute: () => Promise<void>;
  toggleDeaf: () => Promise<void>;
  toggleVideo: () => Promise<void>;
  toggleStream: () => Promise<void>;
  setAudioInputDevice: (deviceId: string) => void;
  setAudioOutputDevice: (deviceId: string) => void;
  setVideoInputDevice: (deviceId: string) => void;
  setInputVolume: (volume: number) => void;
  setOutputVolume: (volume: number) => void;
  updateVoiceStates: (states: VoiceState[]) => void;
  handleVoiceStateUpdate: (state: VoiceState) => void;
}

export const useVoiceStore = create<VoiceStore>((set, get) => ({
  connected: false,
  channelId: null,
  guildId: null,
  selfMute: false,
  selfDeaf: false,
  selfVideo: false,
  selfStream: false,
  lkToken: null,
  lkEndpoint: null,
  lkRoom: null,
  channelVoiceStates: [],

  // Load saved device preferences
  audioInputDevice: localStorage.getItem('audio_input_device') || 'default',
  audioOutputDevice: localStorage.getItem('audio_output_device') || 'default',
  videoInputDevice: localStorage.getItem('video_input_device') || '',
  inputVolume: Number(localStorage.getItem('input_volume')) || 100,
  outputVolume: Number(localStorage.getItem('output_volume')) || 100,

  joinChannel: async (guildId, channelId) => {
    try {
      const data = await api.joinVoice(channelId, guildId);

      set({
        connected: true,
        channelId,
        guildId,
        selfMute: false,
        selfDeaf: false,
        selfVideo: false,
        selfStream: false,
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
      await api.leaveVoice(channelId);
    } catch {
      // Best effort
    }

    set({
      connected: false,
      channelId: null,
      guildId: null,
      selfMute: false,
      selfDeaf: false,
      selfVideo: false,
      selfStream: false,
      lkToken: null,
      lkEndpoint: null,
      lkRoom: null,
      channelVoiceStates: [],
    });
  },

  setLkRoom: (room) => {
    set({ lkRoom: room });
  },

  toggleMute: async () => {
    const newMute = !get().selfMute;
    set({ selfMute: newMute });
    api.updateVoiceState({ self_mute: newMute }).catch(() => {});
  },

  toggleDeaf: async () => {
    const newDeaf = !get().selfDeaf;
    set({
      selfDeaf: newDeaf,
      selfMute: newDeaf ? true : get().selfMute,
    });
    api.updateVoiceState({ self_deaf: newDeaf }).catch(() => {});
  },

  toggleVideo: async () => {
    const newVideo = !get().selfVideo;
    const room = get().lkRoom;
    // Must call LiveKit directly from user gesture context (click handler)
    if (room?.localParticipant) {
      try {
        await room.localParticipant.setCameraEnabled(newVideo);
        set({ selfVideo: newVideo });
        api.updateVoiceStateFull({ self_video: newVideo }).catch(() => {});
      } catch (err) {
        console.error('Camera toggle failed:', err);
      }
    }
  },

  toggleStream: async () => {
    const newStream = !get().selfStream;
    const room = get().lkRoom;
    // Must call LiveKit directly from user gesture context (click handler)
    if (room?.localParticipant) {
      try {
        await room.localParticipant.setScreenShareEnabled(newStream);
        set({ selfStream: newStream });
        api.updateVoiceStateFull({ self_stream: newStream }).catch(() => {});
      } catch (err) {
        console.error('Screen share toggle failed:', err);
        // User cancelled the screen share picker
      }
    }
  },

  setAudioInputDevice: (deviceId) => {
    localStorage.setItem('audio_input_device', deviceId);
    set({ audioInputDevice: deviceId });
  },

  setAudioOutputDevice: (deviceId) => {
    localStorage.setItem('audio_output_device', deviceId);
    set({ audioOutputDevice: deviceId });
  },

  setVideoInputDevice: (deviceId) => {
    localStorage.setItem('video_input_device', deviceId);
    set({ videoInputDevice: deviceId });
  },

  setInputVolume: (volume) => {
    localStorage.setItem('input_volume', String(volume));
    set({ inputVolume: volume });
  },

  setOutputVolume: (volume) => {
    localStorage.setItem('output_volume', String(volume));
    set({ outputVolume: volume });
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
