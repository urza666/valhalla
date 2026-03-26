/**
 * UserAvatar — Discord-style avatar component.
 * Ported from lan-party-platform with Valhalla adaptations.
 * Supports: image/color/initials fallback, speaking indicator, status dot, click/context menu.
 */

export interface UserAvatarUser {
  id?: string;
  username?: string;
  display_name?: string | null;
  avatar?: string | null;
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
  online: '#23a55a',
  idle: '#f0b232',
  dnd: '#f23f43',
  invisible: '#80848e',
  offline: '#80848e',
};

export function UserAvatar({
  user,
  size = 32,
  fontSize,
  showStatus = false,
  status,
  onClick,
  onContextMenu,
  style,
  speaking,
}: UserAvatarProps) {
  const name = user.display_name || user.username || '?';
  const initial = name.charAt(0).toUpperCase();
  const avatar = user.avatar || '';
  const fs = fontSize || `${Math.max(size * 0.38, 10)}px`;
  const statusDotSize = Math.max(size * 0.32, 10);

  const avatarStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    background: 'var(--brand-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: fs,
    fontWeight: 700,
    color: '#fff',
    overflow: 'hidden',
    flexShrink: 0,
  };

  const renderInner = () => {
    if (avatar && avatar.startsWith('color:')) {
      return (
        <div style={{ ...avatarStyle, background: avatar.replace('color:', '') }}>
          {initial}
        </div>
      );
    }
    if (avatar && !avatar.startsWith('color:')) {
      return (
        <div style={avatarStyle}>
          <img
            src={avatar.startsWith('http') ? avatar : `/api/v1/attachments/${avatar}`}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).parentElement!.textContent = initial;
            }}
          />
        </div>
      );
    }
    return <div style={avatarStyle}>{initial}</div>;
  };

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{
        position: 'relative',
        flexShrink: 0,
        cursor: (onClick || onContextMenu) ? 'pointer' : 'default',
        border: speaking ? '2px solid #23a55a' : '2px solid transparent',
        borderRadius: '50%',
        transition: 'border-color 0.15s',
        ...style,
      }}
    >
      {renderInner()}
      {showStatus && status && (
        <div style={{
          position: 'absolute',
          bottom: -1,
          right: -1,
          width: statusDotSize,
          height: statusDotSize,
          borderRadius: '50%',
          background: STATUS_COLORS[status] || '#80848e',
          border: `${Math.max(statusDotSize * 0.2, 2)}px solid var(--bg-secondary, #2b2d31)`,
        }} />
      )}
    </div>
  );
}
