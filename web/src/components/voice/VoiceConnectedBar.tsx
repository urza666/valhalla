import { useVoiceStore } from '../../stores/voice';
import { useAppStore } from '../../stores/app';
import { Icons } from '../common/Icons';

export function VoiceConnectedBar() {
  const {
    connected, channelId, guildId,
    selfMute, selfDeaf, selfVideo, selfStream, lkRoom,
    leaveChannel, toggleMute, toggleDeaf, toggleVideo, toggleStream,
  } = useVoiceStore();

  const { channels } = useAppStore();

  if (!connected || !channelId || !guildId) return null;

  const guildChannels = channels.get(guildId) || [];
  const channel = guildChannels.find((c) => c.id === channelId);
  const roomReady = !!lkRoom;

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
          className={`voice-btn ${selfMute ? 'active muted' : ''}`}
          onClick={toggleMute}
          title={selfMute ? 'Mikrofon einschalten' : 'Mikrofon ausschalten'}
        >
          {selfMute ? <Icons.MicOff /> : <Icons.Mic />}
        </button>
        <button
          className={`voice-btn ${selfDeaf ? 'active muted' : ''}`}
          onClick={toggleDeaf}
          title={selfDeaf ? 'Audio einschalten' : 'Audio ausschalten'}
        >
          {selfDeaf ? <Icons.HeadphonesOff /> : <Icons.Headphones />}
        </button>
        <button
          className={`voice-btn ${selfVideo ? 'active' : ''}`}
          onClick={toggleVideo}
          disabled={!roomReady}
          title={selfVideo ? 'Kamera ausschalten' : 'Kamera einschalten'}
        >
          {selfVideo ? <Icons.Video /> : <Icons.VideoOff />}
        </button>
        <button
          className={`voice-btn ${selfStream ? 'active streaming' : ''}`}
          onClick={toggleStream}
          disabled={!roomReady}
          title={selfStream ? 'Bildschirmfreigabe beenden' : 'Bildschirm teilen'}
        >
          {selfStream ? <Icons.Monitor /> : <Icons.MonitorOff />}
        </button>
        <button
          className="voice-btn disconnect"
          onClick={leaveChannel}
          title="Verbindung trennen"
        >
          <Icons.PhoneOff />
        </button>
      </div>
    </div>
  );
}
