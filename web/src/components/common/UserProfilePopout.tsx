import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { toast } from '../../stores/toast';

interface Props {
  userId: string;
  x: number;
  y: number;
  onClose: () => void;
}

export function UserProfilePopout({ userId, x, y, onClose }: Props) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getUserProfile(userId).then(setProfile).catch(() => {});
  }, [userId]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const el = document.getElementById('user-popout');
      if (el && !el.contains(e.target as Node)) onClose();
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

  const adjustedX = Math.min(x, window.innerWidth - 320);
  const adjustedY = Math.min(y, window.innerHeight - 350);

  const openDM = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const channel = await api.createDM(userId);
      // Store DM channel info and navigate — dispatch custom event for AppLayout
      window.dispatchEvent(new CustomEvent('valhalla:open-dm', {
        detail: { channelId: channel.id, recipientName: profile.display_name || profile.username },
      }));
      toast.success(`DM mit ${profile.display_name || profile.username} geöffnet`);
      onClose();
    } catch (err: any) {
      if (err?.status === 409 || err?.message?.includes('already')) {
        // DM already exists — try to navigate anyway
        try {
          const dms = await api.getMyDMs();
          const existingDm = dms.find((dm) => dm.recipient?.id === userId);
          if (existingDm) {
            window.dispatchEvent(new CustomEvent('valhalla:open-dm', {
              detail: { channelId: existingDm.id, recipientName: profile.display_name || profile.username },
            }));
            toast.success(`DM mit ${profile.display_name || profile.username} geöffnet`);
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
      toast.error('Anfrage konnte nicht gesendet werden');
    }
  };

  return (
    <div
      id="user-popout"
      className="user-popout"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {/* Banner area */}
      <div className="user-popout-banner" />

      {/* Avatar */}
      <div className="user-popout-avatar">
        {(profile.username || '?')[0].toUpperCase()}
      </div>

      {/* Info */}
      <div className="user-popout-body">
        <div className="user-popout-name">{profile.display_name || profile.username}</div>
        <div className="user-popout-tag">@{profile.username}</div>

        {profile.bio && (
          <div className="user-popout-section">
            <div className="user-popout-section-title">Über mich</div>
            <div className="user-popout-bio">{profile.bio}</div>
          </div>
        )}

        <div className="user-popout-actions">
          <button
            className="btn"
            style={{ flex: 1, fontSize: 14, padding: '8px 12px' }}
            onClick={openDM}
            disabled={loading}
          >
            {loading ? 'Wird geöffnet...' : 'Nachricht senden'}
          </button>
          <button
            className="btn"
            style={{ width: 'auto', fontSize: 14, padding: '8px 12px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
            onClick={sendFriend}
            title="Freundschaftsanfrage senden"
          >
            ➕
          </button>
        </div>
      </div>
    </div>
  );
}
