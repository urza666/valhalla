import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAppStore } from '../../stores/app';
import { toast } from '../../stores/toast';

interface Props {
  userId: string;
  x: number;
  y: number;
  onClose: () => void;
}

export function UserProfilePopout({ userId, x, y, onClose }: Props) {
  const [profile, setProfile] = useState<any>(null);

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
    try {
      const channel = await api.createDM(userId);
      const { selectChannel } = useAppStore.getState();
      selectChannel(channel.id);
      toast.success('DM-Kanal geöffnet');
      onClose();
    } catch {
      toast.error('DM konnte nicht erstellt werden');
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
          >
            Nachricht senden
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
