import { useEffect, useState } from 'react';
import { useVoiceStore } from '../../stores/voice';
import { useAuthStore } from '../../stores/auth';
import { api } from '../../api/client';

interface Props {
  channelId: string;
  guildId: string;
}

// Cache for user info so we don't refetch constantly
interface UserInfo {
  name: string;
  avatar: string | null;
}
const userInfoCache = new Map<string, UserInfo>();

async function resolveUserInfo(userId: string): Promise<UserInfo> {
  if (userInfoCache.has(userId)) return userInfoCache.get(userId)!;
  try {
    const profile = await api.getUserProfile(userId);
    const info: UserInfo = {
      name: profile.display_name || profile.username || userId.slice(-4),
      avatar: profile.avatar,
    };
    userInfoCache.set(userId, info);
    return info;
  } catch {
    return { name: `User ${userId.slice(-4)}`, avatar: null };
  }
}

export function VoiceChannel({ channelId, guildId }: Props) {
  const { connected, channelId: currentChannelId, channelVoiceStates, joinChannel } = useVoiceStore();
  const { gateway, user } = useAuthStore();
  const { handleVoiceStateUpdate } = useVoiceStore();
  const [userInfos, setUserInfos] = useState<Map<string, UserInfo>>(new Map());

  const isThisChannel = connected && currentChannelId === channelId;
  const usersInChannel = channelVoiceStates.filter((s) => s.channel_id === channelId);

  useEffect(() => {
    if (!gateway) return;
    const unsub = gateway.on('VOICE_STATE_UPDATE', (data) => {
      handleVoiceStateUpdate(data as any);
    });
    return () => { unsub(); };
  }, [gateway, handleVoiceStateUpdate]);

  // Resolve user info for all users in channel
  useEffect(() => {
    const resolve = async () => {
      const newInfos = new Map(userInfos);
      let changed = false;
      for (const state of usersInChannel) {
        if (!newInfos.has(state.user_id)) {
          if (state.user_id === user?.id) {
            newInfos.set(state.user_id, {
              name: user.display_name || user.username,
              avatar: user.avatar,
            });
            changed = true;
          } else {
            const info = await resolveUserInfo(state.user_id);
            newInfos.set(state.user_id, info);
            changed = true;
          }
        }
      }
      if (changed) setUserInfos(newInfos);
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
        const info = userInfos.get(state.user_id) || { name: state.user_id.slice(-4), avatar: null };
        return (
          <div key={state.user_id} className="voice-user">
            <div className="voice-user-avatar">
              {info.avatar ? (
                <img
                  src={`/api/v1/attachments/${info.avatar}`}
                  alt=""
                  className="voice-user-avatar-img"
                  style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div className={`voice-user-ring ${state.self_mute ? '' : 'speaking-capable'}`}>
                  {info.name[0].toUpperCase()}
                </div>
              )}
            </div>
            <span className="voice-user-name">
              {info.name}
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
