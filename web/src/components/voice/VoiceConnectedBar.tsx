import { useVoiceStore } from '../../stores/voice';
import { useAppStore } from '../../stores/app';

export function VoiceConnectedBar() {
  const {
    connected, channelId, guildId,
    selfMute, selfDeaf, selfVideo, selfStream,
    leaveChannel, toggleMute, toggleDeaf, toggleVideo, toggleStream,
  } = useVoiceStore();

  const { channels } = useAppStore();

  if (!connected || !channelId || !guildId) return null;

  const guildChannels = channels.get(guildId) || [];
  const channel = guildChannels.find((c) => c.id === channelId);

  return (
    <div className="voice-bar">
      <div className="voice-bar-info">
        <div className="voice-bar-status">
          <span className="voice-bar-dot" />
          Sprache verbunden
        </div>
        <div className="voice-bar-channel">
          {channel?.name || 'Unbekannter Kanal'}
        </div>
      </div>

      <div className="voice-bar-controls">
        <button
          className={`voice-btn ${selfMute ? 'active' : ''}`}
          onClick={toggleMute}
          title={selfMute ? 'Mikrofon einschalten' : 'Mikrofon ausschalten'}
        >
          {selfMute ? '🔇' : '🎙️'}
        </button>
        <button
          className={`voice-btn ${selfDeaf ? 'active' : ''}`}
          onClick={toggleDeaf}
          title={selfDeaf ? 'Audio einschalten' : 'Audio ausschalten'}
        >
          {selfDeaf ? '🔕' : '🔊'}
        </button>
        <button
          className={`voice-btn ${selfVideo ? 'active' : ''}`}
          onClick={toggleVideo}
          title={selfVideo ? 'Kamera ausschalten' : 'Kamera einschalten'}
        >
          {selfVideo ? '📷' : '📷'}
          {!selfVideo && <span className="voice-btn-off-line" />}
        </button>
        <button
          className={`voice-btn ${selfStream ? 'active' : ''}`}
          onClick={toggleStream}
          title={selfStream ? 'Bildschirmfreigabe beenden' : 'Bildschirm teilen'}
        >
          🖥️
          {!selfStream && <span className="voice-btn-off-line" />}
        </button>
        <button
          className="voice-btn disconnect"
          onClick={leaveChannel}
          title="Verbindung trennen"
        >
          📞
        </button>
      </div>
    </div>
  );
}
