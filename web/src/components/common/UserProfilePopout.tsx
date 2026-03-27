/**
 * UserProfilePopout — Discord-style profile card with banner, avatar, bio, and actions.
 * Enhanced from LPP with richer design. Uses Valhalla Go API.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api/client';
import { useAuthStore } from '../../stores/auth';
import { toast } from '../../stores/toast';
import { UserAvatar } from './UserAvatar';

interface Props {
  userId: string;
  x: number;
  y: number;
  onClose: () => void;
}

interface ProfileData {
  id: string;
  username: string;
  display_name: string | null;
  avatar: string | null;
  bio: string | null;
}

export function UserProfilePopout({ userId, x, y, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const currentUser = useAuthStore((s) => s.user);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const isMe = userId === currentUser?.id;

  useEffect(() => {
    api.getUserProfile(userId).then((p) => setProfile(p as ProfileData)).catch(() => {});
  }, [userId]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  if (!profile) return null;

  const adjustedX = Math.min(x, window.innerWidth - 340);
  const adjustedY = Math.min(y, window.innerHeight - 380);
  const displayName = profile.display_name || profile.username;

  const openDM = async () => {
    if (loading || isMe) return;
    setLoading(true);
    try {
      const channel = await api.createDM(userId);
      window.dispatchEvent(new CustomEvent('valhalla:open-dm', {
        detail: { channelId: channel.id, recipientName: displayName },
      }));
      toast.success(`DM mit ${displayName} geoeffnet`);
      onClose();
    } catch (err: unknown) {
      const apiErr = err as { status?: number; message?: string };
      if (apiErr?.status === 409 || apiErr?.message?.includes('already')) {
        try {
          const dms = await api.getMyDMs();
          const existing = dms.find((dm) => dm.recipient?.id === userId);
          if (existing) {
            window.dispatchEvent(new CustomEvent('valhalla:open-dm', {
              detail: { channelId: existing.id, recipientName: displayName },
            }));
            toast.success(`DM mit ${displayName} geoeffnet`);
            onClose();
            return;
          }
        } catch { /* ignore */ }
      }
      toast.error('DM konnte nicht erstellt werden');
    } finally {
      setLoading(false);
    }
  };

  const sendFriend = async () => {
    try {
      await api.sendFriendRequest(profile.username);
      toast.success('Freundschaftsanfrage gesendet');
    } catch {
      toast.error('Anfrage fehlgeschlagen');
    }
  };

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: adjustedX,
        top: adjustedY,
        zIndex: 9998,
        width: 320,
        background: 'var(--color-voice-surface-modal, var(--bg-tertiary))',
        borderRadius: 12,
        boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        border: '1px solid var(--color-voice-border)',
        overflow: 'hidden',
        animation: 'fadeIn 150ms ease-out',
      }}
    >
      {/* Banner */}
      <div style={{
        height: 60,
        background: 'linear-gradient(135deg, var(--color-voice-accent), var(--brand-primary))',
        position: 'relative',
      }} />

      {/* Avatar — overlapping banner */}
      <div style={{ position: 'relative', padding: '0 1rem', marginTop: -28 }}>
        <div style={{
          display: 'inline-block',
          border: '4px solid var(--color-voice-surface-modal, var(--bg-tertiary))',
          borderRadius: '50%',
        }}>
          <UserAvatar
            user={{ id: profile.id, username: profile.username, display_name: profile.display_name, avatar: profile.avatar }}
            size={56}
          />
        </div>
      </div>

      {/* Info */}
      <div style={{ padding: '0.5rem 1rem 1rem' }}>
        <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {displayName}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
          @{profile.username}
        </div>

        {/* Bio */}
        {profile.bio && (
          <div style={{
            padding: '0.5rem',
            background: 'var(--color-voice-surface, var(--bg-secondary))',
            borderRadius: 8,
            marginBottom: '0.6rem',
          }}>
            <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
              About
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {profile.bio}
            </div>
          </div>
        )}

        {/* Actions */}
        {!isMe && (
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              className="btn-primary"
              style={{ flex: 1, fontSize: 13, padding: '8px 12px' }}
              onClick={openDM}
              disabled={loading}
            >
              {loading ? 'Wird geoeffnet...' : 'Nachricht senden'}
            </button>
            <button
              className="btn-secondary"
              style={{ width: 'auto', fontSize: 13, padding: '8px 12px' }}
              onClick={sendFriend}
              title="Freundschaftsanfrage senden"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
