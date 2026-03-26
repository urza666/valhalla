import { useEffect, useState } from 'react';
import { useVoiceStore } from '../../stores/voice';
import { useAuthStore } from '../../stores/auth';
import { api } from '../../api/client';

interface Props {
  channelId: string;
  guildId: string;
}

// Cache for user display names so we don't refetch constantly
const userNameCache = new Map<string, string>();

async function resolveUserName(userId: string): Promise<string> {
  if (userNameCache.has(userId)) return userNameCache.get(userId)!;
  try {
    const profile = await api.getUserProfile(userId);
    const name = profile.display_name || profile.username || userId.slice(-4);
    userNameCache.set(userId, name);
    return name;
  } catch {
    return `User ${userId.slice(-4)}`;
  }
}

export function VoiceChannel({ channelId, guildId }: Props) {
  const { connected, channelId: currentChannelId, channelVoiceStates, joinChannel } = useVoiceStore();
  const { gateway, user } = useAuthStore();
  const { handleVoiceStateUpdate } = useVoiceStore();
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());

  const isThisChannel = connected && currentChannelId === channelId;
  const usersInChannel = channelVoiceStates.filter((s) => s.channel_id === channelId);

  useEffect(() => {
    if (!gateway) return;
    const unsub = gateway.on('VOICE_STATE_UPDATE', (data) => {
      handleVoiceStateUpdate(data as any);
    });
    return () => { unsub(); };
  }, [gateway, handleVoiceStateUpdate]);

  // Resolve user names for all users in channel
  useEffect(() => {
    const resolve = async () => {
      const newNames = new Map(userNames);
      let changed = false;
      for (const state of usersInChannel) {
        if (!newNames.has(state.user_id)) {
          // Check if it's the current user
          if (state.user_id === user?.id) {
            newNames.set(state.user_id, user.display_name || user.username);
            changed = true;
          } else {
            const name = await resolveUserName(state.user_id);
            newNames.set(state.user_id, name);
            changed = true;
          }
        }
      }
      if (changed) setUserNames(newNames);
    };
    if (usersInChannel.length > 0) resolve();
  }, [usersInChannel.map(u => u.user_id).join(',')]);

  return (
    <div className="voice-channel-panel">
      {usersInChannel.length === 0 && !isThisChannel && (
        <div className="voice-empty">
          <button
            className="voice-join-btn"
            onClick={() => joinChannel(guildId, channelId)}
            aria-label="Sprachkanal beitreten"
          >
            Beitreten
          </button>
        </div>
      )}

      {usersInChannel.map((state) => {
        const displayName = userNames.get(state.user_id) || state.user_id.slice(-4);
        return (
          <div key={state.user_id} className="voice-user">
            <div className="voice-user-avatar">
              <div className={`voice-user-ring ${state.self_mute ? '' : 'speaking-capable'}`}>
                {displayName[0].toUpperCase()}
              </div>
            </div>
            <span className="voice-user-name">
              {displayName}
              {state.self_mute && ' 🔇'}
              {state.self_deaf && ' 🔕'}
              {state.self_video && ' 📷'}
              {state.self_stream && ' 🖥️'}
            </span>
          </div>
        );
      })}

      {!isThisChannel && usersInChannel.length > 0 && (
        <button
          className="voice-join-btn small"
          onClick={() => joinChannel(guildId, channelId)}
          aria-label="Sprachkanal beitreten"
        >
          Beitreten
        </button>
      )}
    </div>
  );
}
