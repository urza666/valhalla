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
        {/* Mute mic */}
        <button
          className={`voice-btn ${selfMute ? 'active muted' : ''}`}
          onClick={toggleMute}
          title={selfMute ? 'Mikrofon einschalten' : 'Mikrofon ausschalten'}
        >
          {selfMute ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zM14.98 11.17L7.8 4H12V2H6v5.8l8.98 3.37zM4.27 3L3 4.27 9.73 11H9v1c0 1.66 1.34 3 3 3 .23 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-2.28c.88-.12 1.71-.44 2.43-.89L19.73 22 21 20.73 4.27 3z"/></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c0 3-2.54 5.1-5.91 5.1S6.09 14 6.09 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.49 6-3.31 6-6.72h-1.09z"/></svg>
          )}
        </button>

        {/* Deafen */}
        <button
          className={`voice-btn ${selfDeaf ? 'active muted' : ''}`}
          onClick={toggleDeaf}
          title={selfDeaf ? 'Audio einschalten' : 'Audio ausschalten'}
        >
          {selfDeaf ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
          )}
        </button>

        {/* Camera */}
        <button
          className={`voice-btn ${selfVideo ? 'active' : ''}`}
          onClick={toggleVideo}
          title={selfVideo ? 'Kamera ausschalten' : 'Kamera einschalten'}
        >
          {selfVideo ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/></svg>
          )}
        </button>

        {/* Screen share */}
        <button
          className={`voice-btn ${selfStream ? 'active streaming' : ''}`}
          onClick={toggleStream}
          title={selfStream ? 'Bildschirmfreigabe beenden' : 'Bildschirm teilen'}
        >
          {selfStream ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/><path d="M10 15l5-3.5L10 8v7z" fill="var(--status-online)"/></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/></svg>
          )}
        </button>

        {/* Disconnect */}
        <button
          className="voice-btn disconnect"
          onClick={leaveChannel}
          title="Verbindung trennen"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.956.956 0 010-1.36C3.31 8.67 7.41 7 12 7s8.69 1.67 11.71 4.72c.18.18.29.44.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.73-1.68-1.36-2.66-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
        </button>
      </div>
    </div>
  );
}
