/**
 * VoiceVideoGrid — Discord-style participant grid for voice channels.
 * Shows video tiles, screen shares, speaking indicators.
 * Ported from LPP VoicePage VoiceVideoGrid section.
 */
import { useVoiceStore } from '../../stores/voice';
import { useAuthStore } from '../../stores/auth';
import { UserAvatar } from '../common/UserAvatar';
import type { RemoteParticipant } from 'livekit-client';

export function VoiceVideoGrid() {
  const { connected, lkRoom, selfMute, selfDeaf, selfVideo } = useVoiceStore();
  const user = useAuthStore((s) => s.user);

  if (!connected || !lkRoom) return null;

  const participants = Array.from(lkRoom.remoteParticipants.values()) as RemoteParticipant[];
  const localParticipant = lkRoom.localParticipant;

  // Count participants including self
  const totalCount = participants.length + 1;
  const cols = totalCount <= 2 ? totalCount : totalCount <= 4 ? 2 : totalCount <= 9 ? 3 : 4;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: 8,
      padding: 8,
      maxHeight: 300,
      overflowY: 'auto',
    }}>
      {/* Local participant */}
      <ParticipantTile
        name={user?.display_name || user?.username || 'Du'}
        avatar={user?.avatar}
        isMuted={selfMute}
        isDeafened={selfDeaf}
        hasVideo={selfVideo}
        isSelf
        speaking={localParticipant?.isSpeaking || false}
      />

      {/* Remote participants */}
      {participants.map((p) => (
        <ParticipantTile
          key={p.sid}
          name={p.name || p.identity}
          isMuted={p.isMicrophoneEnabled === false}
          isDeafened={false}
          hasVideo={p.isCameraEnabled || false}
          speaking={p.isSpeaking}
        />
      ))}
    </div>
  );
}

function ParticipantTile({ name, avatar, isMuted, isDeafened, hasVideo, isSelf, speaking }: {
  name: string;
  avatar?: string | null;
  isMuted: boolean;
  isDeafened: boolean;
  hasVideo: boolean;
  isSelf?: boolean;
  speaking: boolean;
}) {
  return (
    <div
      className={`voice-participant-tile ${speaking ? 'speaking' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 12,
        background: 'var(--color-voice-surface, var(--bg-secondary))',
        borderRadius: 8,
        border: speaking ? '2px solid var(--color-voice-online)' : '2px solid transparent',
        transition: 'border-color 0.2s',
        position: 'relative',
      }}
    >
      <UserAvatar
        user={{ username: name, display_name: name, avatar: avatar || null }}
        size={48}
        speaking={speaking}
      />
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--text-primary)',
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        textAlign: 'center',
      }}>
        {name}{isSelf ? ' (Du)' : ''}
      </div>

      {/* Status indicators */}
      <div style={{ display: 'flex', gap: 4, position: 'absolute', bottom: 4, right: 4 }}>
        {isMuted && (
          <span title="Stummgeschaltet" style={{ fontSize: 10, background: 'rgba(237,66,69,0.3)', borderRadius: 4, padding: '1px 4px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.5">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M9 9v3a3 3 0 005.12 2.12" />
            </svg>
          </span>
        )}
        {isDeafened && (
          <span title="Taub" style={{ fontSize: 10, background: 'rgba(237,66,69,0.3)', borderRadius: 4, padding: '1px 4px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.5">
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          </span>
        )}
        {hasVideo && (
          <span title="Kamera aktiv" style={{ fontSize: 10, background: 'rgba(59,165,93,0.3)', borderRadius: 4, padding: '1px 4px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-voice-online)" strokeWidth="2">
              <path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" />
            </svg>
          </span>
        )}
      </div>
    </div>
  );
}
