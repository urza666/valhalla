/**
 * UserProfilePopout — LPP-identical Discord-style profile card.
 * Banner + Avatar + Name + Status + Bio + Actions.
 * Adapted for Valhalla Go API (no teams/tournaments/wallet/seat).
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../../api/client';
import { useAuthStore } from '../../stores/auth';
import { toast } from '../../stores/toast';
import { UserAvatar } from './UserAvatar';

interface ProfileData {
  id: string;
  username: string;
  display_name: string | null;
  avatar: string | null;
  bio: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  online: '#3ba55d', idle: '#faa81a', dnd: '#ed4245', offline: '#747f8d',
};

export function UserProfilePopout({ userId, x, y, onClose }: {
  userId: string; x: number; y: number; onClose: () => void;
}) {
  const currentUser = useAuthStore((s) => s.user);
  const isMe = userId === currentUser?.id;
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const stableClose = useCallback(() => onCloseRef.current(), []);

  useEffect(() => {
    api.getUserProfile(userId).then((p) => setProfile(p as ProfileData)).catch(() => {});
  }, [userId]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) stableClose();
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', h), 150);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', h); };
  }, [stableClose]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') stableClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [stableClose]);

  if (!profile) return null;

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
      stableClose();
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
            stableClose();
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

  return (
    <div
      ref={ref}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: Math.min(y, window.innerHeight - 400),
        left: Math.min(x, window.innerWidth - 320),
        zIndex: 10001,
        width: 310,
        background: '#232428',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        animation: 'fadeIn 0.15s ease-out',
        maxHeight: 'calc(100vh - 40px)',
        overflowY: 'auto',
      }}
    >
      {/* Banner */}
      <div style={{
        height: 52,
        background: 'linear-gradient(135deg, #5865f2, #3ba55d)',
        borderRadius: '12px 12px 0 0',
      }} />

      {/* Avatar */}
      <div style={{ position: 'relative', zIndex: 2, padding: '0 0.7rem', marginTop: -28 }}>
        <div style={{
          display: 'inline-block',
          border: '4px solid #232428',
          borderRadius: '50%',
        }}>
          <UserAvatar
            user={{ username: profile.username, display_name: profile.display_name, avatar: profile.avatar }}
            size={56}
          />
        </div>
      </div>

      {/* Name + Status */}
      <div style={{ padding: '0.2rem 0.7rem 0.3rem' }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
          {displayName}
        </div>
        <div style={{ fontSize: '0.68rem', color: '#96989d' }}>@{profile.username}</div>
        <div style={{ fontSize: '0.58rem', color: STATUS_COLORS.online, fontWeight: 600, marginTop: '0.1rem' }}>
          ● Online
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <div style={{ padding: '0 0.7rem 0.3rem' }}>
          <div style={{
            padding: '0.4rem 0.5rem',
            background: '#1e1f22',
            borderRadius: 8,
          }}>
            <div style={{ fontSize: '0.55rem', fontWeight: 700, color: '#72767d', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.1rem' }}>
              Ueber mich
            </div>
            <div style={{ fontSize: '0.7rem', color: '#dcddde', lineHeight: 1.4 }}>
              {profile.bio}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {!isMe && (
        <div style={{ padding: '0.3rem 0.7rem 0.5rem', display: 'flex', gap: '0.4rem' }}>
          <button
            onClick={openDM}
            disabled={loading}
            style={{
              flex: 1, padding: '0.45rem', borderRadius: 6,
              background: 'var(--color-voice-accent, #5865f2)',
              border: 'none', color: '#fff', fontSize: '0.78rem',
              fontWeight: 600, cursor: 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? '...' : 'Nachricht senden'}
          </button>
          <button
            onClick={sendFriend}
            style={{
              padding: '0.45rem 0.6rem', borderRadius: 6,
              background: '#2b2d31', border: 'none', color: '#dcddde',
              fontSize: '0.78rem', cursor: 'pointer',
            }}
            title="Freundschaftsanfrage"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
