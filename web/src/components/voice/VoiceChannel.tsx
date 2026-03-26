import { useEffect } from 'react';
import { useVoiceStore } from '../../stores/voice';
import { useAuthStore } from '../../stores/auth';

interface Props {
  channelId: string;
  guildId: string;
}

export function VoiceChannel({ channelId, guildId }: Props) {
  const { connected, channelId: currentChannelId, channelVoiceStates, joinChannel } = useVoiceStore();
  const { gateway } = useAuthStore();
  const { handleVoiceStateUpdate } = useVoiceStore();

  const isThisChannel = connected && currentChannelId === channelId;
  const usersInChannel = channelVoiceStates.filter((s) => s.channel_id === channelId);

  // Listen for voice state updates
  useEffect(() => {
    if (!gateway) return;
    return gateway.on('VOICE_STATE_UPDATE', (data) => {
      handleVoiceStateUpdate(data as any);
    });
  }, [gateway, handleVoiceStateUpdate]);

  return (
    <div className="voice-channel-panel">
      {usersInChannel.length === 0 && !isThisChannel && (
        <div className="voice-empty">
          <button
            className="voice-join-btn"
            onClick={() => joinChannel(guildId, channelId)}
          >
            Join Voice
          </button>
        </div>
      )}

      {usersInChannel.map((state) => (
        <div key={state.user_id} className="voice-user">
          <div className="voice-user-avatar">
            <div className={`voice-user-ring ${false ? 'speaking' : ''}`}>
              U
            </div>
          </div>
          <span className="voice-user-name">
            User {state.user_id.slice(-4)}
            {state.self_mute && ' 🔇'}
            {state.self_deaf && ' 🔕'}
          </span>
        </div>
      ))}

      {!isThisChannel && usersInChannel.length > 0 && (
        <button
          className="voice-join-btn small"
          onClick={() => joinChannel(guildId, channelId)}
        >
          Join
        </button>
      )}
    </div>
  );
}
