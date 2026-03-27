/**
 * UserBarPanel — Bottom-left user info + voice controls.
 * Extracted from ChannelSidebar, enhanced with LPP's camera/screen controls.
 */
import { useState } from 'react';
import { useAuthStore } from '../../stores/auth';
import { useVoiceStore } from '../../stores/voice';
import { UserAvatar } from '../common/UserAvatar';
import { UserSettings } from '../admin/UserSettings';

export function UserBarPanel() {
  const user = useAuthStore((s) => s.user);
  const { selfMute, selfDeaf, selfVideo, selfStream, connected,
    toggleMute, toggleDeaf, toggleVideo, toggleStream } = useVoiceStore();
  const [showUserSettings, setShowUserSettings] = useState(false);

  if (!user) return null;

  return (
    <>
      <div className="user-panel">
        <UserAvatar
          user={{ username: user.username, display_name: user.display_name, avatar: user.avatar }}
          size={32}
          showStatus
          status="online"
        />
        <div
          className="user-panel-info"
          onClick={() => setShowUserSettings(true)}
          style={{ cursor: 'pointer' }}
        >
          <div className="user-panel-name">{user.display_name || user.username}</div>
          <div className="user-panel-status">Online</div>
        </div>
        <div className="user-panel-buttons">
          {/* Camera — only when connected to voice */}
          {connected && (
            <button
              className="user-panel-btn"
              onClick={toggleVideo}
              title={selfVideo ? 'Kamera aus' : 'Kamera an'}
            >
              {selfVideo ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--status-online)" strokeWidth="2">
                  <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                </svg>
              )}
            </button>
          )}
          {/* Screen Share — only when connected to voice */}
          {connected && (
            <button
              className="user-panel-btn"
              onClick={toggleStream}
              title={selfStream ? 'Bildschirm beenden' : 'Bildschirm teilen'}
            >
              {selfStream ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--status-online)" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><polyline points="8 21 16 21"/><line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><polyline points="8 21 16 21"/><line x1="12" y1="17" x2="12" y2="21"/>
                </svg>
              )}
            </button>
          )}
          {/* Mute */}
          <button
            className="user-panel-btn"
            onClick={toggleMute}
            title={selfMute ? 'Stummschaltung aufheben' : 'Stummschalten'}
          >
            {selfMute ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2">
                <line x1="1" y1="1" x2="23" y2="23"/>
                <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/>
                <path d="M17 16.95A7 7 0 015 12v-2m14 0v2c0 .5-.05.99-.16 1.46"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                <path d="M19 10v2a7 7 0 01-14 0v-2"/>
              </svg>
            )}
          </button>
          {/* Deafen */}
          <button
            className="user-panel-btn"
            onClick={toggleDeaf}
            title={selfDeaf ? 'Audio aktivieren' : 'Audio deaktivieren'}
          >
            {selfDeaf ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2">
                <line x1="1" y1="1" x2="23" y2="23"/>
                <path d="M3 18v-6a9 9 0 0114.5-7.13M21 12v6"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 18v-6a9 9 0 0118 0v6"/>
                <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3z"/>
                <path d="M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/>
              </svg>
            )}
          </button>
          {/* Settings */}
          <button
            className="user-panel-btn"
            onClick={() => setShowUserSettings(true)}
            title="Einstellungen"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.3.68.95 1.13 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
          </button>
        </div>
      </div>

      {showUserSettings && (
        <UserSettings onClose={() => setShowUserSettings(false)} />
      )}
    </>
  );
}
