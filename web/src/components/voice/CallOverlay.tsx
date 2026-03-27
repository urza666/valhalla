/**
 * CallOverlay — MVP call UI for direct voice join.
 * Future: implement ring/answer/decline via WebSocket events.
 */
import { useVoiceStore } from '../../stores/voice';
import { UserAvatar } from '../common/UserAvatar';

interface Props {
  targetUser: {
    id: string;
    username: string;
    display_name: string | null;
    avatar: string | null;
  };
  channelId: string;
  guildId: string;
  onClose: () => void;
}

export function CallOverlay({ targetUser, channelId, guildId, onClose }: Props) {
  const { joinChannel, connected } = useVoiceStore();

  const handleJoin = async () => {
    await joinChannel(guildId, channelId);
    onClose();
  };

  const name = targetUser.display_name || targetUser.username;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9500,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      animation: 'fadeIn 0.2s ease',
    }}>
      <div style={{
        background: 'var(--color-voice-surface-modal, var(--bg-tertiary))',
        borderRadius: 16,
        padding: '2rem',
        textAlign: 'center',
        minWidth: 280,
        boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        animation: 'slideUp 0.2s ease',
      }}>
        <div style={{ marginBottom: 16 }}>
          <UserAvatar
            user={targetUser}
            size={80}
            style={{ margin: '0 auto' }}
          />
        </div>

        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          {name}
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>
          {connected ? 'Bereits im Sprachkanal' : 'Sprachkanal beitreten?'}
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          {!connected && (
            <button
              onClick={handleJoin}
              style={{
                background: 'var(--color-voice-online)',
                color: '#fff',
                border: 'none',
                borderRadius: 24,
                padding: '10px 24px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
              </svg>
              Beitreten
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              background: connected ? 'var(--color-voice-accent)' : 'var(--danger)',
              color: '#fff',
              border: 'none',
              borderRadius: 24,
              padding: '10px 24px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {connected ? 'OK' : 'Abbrechen'}
          </button>
        </div>
      </div>
    </div>
  );
}
