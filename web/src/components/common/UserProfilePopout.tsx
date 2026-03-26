import { useEffect, useState } from 'react';

interface Props {
  userId: string;
  x: number;
  y: number;
  onClose: () => void;
}

export function UserProfilePopout({ userId, x, y, onClose }: Props) {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/v1/users/${userId}/profile`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    })
      .then((r) => r.json())
      .then(setProfile)
      .catch(() => {});
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
  const adjustedY = Math.min(y, window.innerHeight - 300);

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
            <div className="user-popout-section-title">Ueber mich</div>
            <div className="user-popout-bio">{profile.bio}</div>
          </div>
        )}

        <div className="user-popout-actions">
          <button className="btn" style={{ width: '100%', fontSize: 14, padding: '8px 12px' }}>
            Nachricht senden
          </button>
        </div>
      </div>
    </div>
  );
}
