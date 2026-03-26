import { useVoiceStore } from '../../stores/voice';
import { useAppStore } from '../../stores/app';

export function VoiceConnectedBar() {
  const { connected, channelId, guildId, selfMute, selfDeaf, leaveChannel, toggleMute, toggleDeaf } = useVoiceStore();

  const { channels } = useAppStore();

  if (!connected || !channelId || !guildId) return null;

  const guildChannels = channels.get(guildId) || [];
  const channel = guildChannels.find((c) => c.id === channelId);

  return (
    <div className="voice-bar">
      <div className="voice-bar-info">
        <div className="voice-bar-status">
          <span className="voice-bar-dot" />
          Voice Connected
        </div>
        <div className="voice-bar-channel">
          {channel?.name || 'Unknown Channel'}
        </div>
      </div>

      <div className="voice-bar-controls">
        <button
          className={`voice-btn ${selfMute ? 'active' : ''}`}
          onClick={toggleMute}
          title={selfMute ? 'Unmute' : 'Mute'}
        >
          {selfMute ? '🔇' : '🎙️'}
        </button>
        <button
          className={`voice-btn ${selfDeaf ? 'active' : ''}`}
          onClick={toggleDeaf}
          title={selfDeaf ? 'Undeafen' : 'Deafen'}
        >
          {selfDeaf ? '🔕' : '🔊'}
        </button>
        <button
          className="voice-btn disconnect"
          onClick={leaveChannel}
          title="Disconnect"
        >
          📞
        </button>
      </div>
    </div>
  );
}
