/**
 * UserAvatar — LPP-identical avatar component.
 * Supports: image/color/initials fallback, speaking indicator, status dot.
 */

export interface UserAvatarUser {
  id?: string;
  username?: string;
  display_name?: string | null;
  avatar?: string | null;
  avatar_path?: string;
}

interface UserAvatarProps {
  user: UserAvatarUser;
  size?: number;
  fontSize?: string;
  showStatus?: boolean;
  status?: 'online' | 'idle' | 'dnd' | 'invisible' | 'offline';
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
  speaking?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  online: '#3ba55d',
  idle: '#faa81a',
  dnd: '#ed4245',
  invisible: '#747f8d',
  offline: '#747f8d',
};

export function UserAvatar({
  user, size = 32, fontSize, showStatus = false, status,
  onClick, onContextMenu, style, speaking,
}: UserAvatarProps) {
  const name = user.display_name || user.username || '?';
  const initial = name.charAt(0).toUpperCase();
  const avatar = user.avatar_path || user.avatar || '';
  const fs = fontSize || `${Math.max(size * 0.38, 10)}px`;
  const statusDotSize = Math.max(size * 0.32, 10);

  const baseStyle: React.CSSProperties = {
    width: size, height: size, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: fs, fontWeight: 700, color: '#fff', overflow: 'hidden',
    flexShrink: 0,
  };

  const renderInner = () => {
    if (avatar && avatar.startsWith('color:')) {
      return <div style={{ ...baseStyle, background: avatar.replace('color:', '') }}>{initial}</div>;
    }
    if (avatar && !avatar.startsWith('color:')) {
      const src = avatar.startsWith('http') || avatar.startsWith('/') ? avatar : `/api/v1/attachments/${avatar}`;
      return (
        <div style={{ ...baseStyle, background: 'var(--brand-primary, #5865f2)' }}>
          <img
            src={src} alt="" loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).parentElement!.textContent = initial;
            }}
          />
        </div>
      );
    }
    return <div style={{ ...baseStyle, background: 'var(--brand-primary, #5865f2)' }}>{initial}</div>;
  };

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{
        position: 'relative', flexShrink: 0,
        cursor: (onClick || onContextMenu) ? 'pointer' : 'default',
        border: speaking ? '2px solid #3ba55d' : '2px solid transparent',
        borderRadius: '50%',
        transition: 'border-color 0.15s',
        ...style,
      }}
    >
      {renderInner()}
      {showStatus && status && (
        <div style={{
          position: 'absolute', bottom: -1, right: -1,
          width: statusDotSize, height: statusDotSize,
          borderRadius: '50%',
          background: STATUS_COLORS[status] || '#747f8d',
          border: `${Math.max(statusDotSize * 0.2, 2)}px solid var(--bg-secondary, #232428)`,
        }} />
      )}
    </div>
  );
}
