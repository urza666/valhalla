import { useState } from 'react';
import { useVoiceStore } from '../../stores/voice';
import { useAppStore } from '../../stores/app';
import { Icons } from '../common/Icons';
import { VoiceSettingsPanel } from './VoiceSettingsPanel';

export function VoiceConnectedBar() {
  const {
    connected, channelId, guildId,
    selfMute, selfDeaf, selfVideo, selfStream, lkRoom,
    leaveChannel, toggleMute, toggleDeaf, toggleVideo, toggleStream,
  } = useVoiceStore();

  const { channels } = useAppStore();
  const [showSettings, setShowSettings] = useState(false);

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
          className="voice-btn"
          onClick={() => setShowSettings(true)}
          title="Spracheinstellungen"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.3.68.95 1.13 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>
        <button
          className="voice-btn disconnect"
          onClick={leaveChannel}
          title="Verbindung trennen"
        >
          <Icons.PhoneOff />
        </button>
      </div>

      <VoiceSettingsPanel open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
