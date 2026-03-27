/**
 * UserContextMenu — Discord-style right-click menu for users.
 * Ported from lan-party-platform, adapted for Valhalla Go API.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../api/client';
import { useAuthStore } from '../../stores/auth';
import { toast } from '../../stores/toast';
import { UserAvatar, type UserAvatarUser } from './UserAvatar';

export interface UserTarget {
  id: string;
  username: string;
  display_name: string;
  avatar?: string | null;
}

interface ContextMenuProps {
  target: UserTarget;
  x: number;
  y: number;
  onClose: () => void;
  onStartChat?: (userId: string) => void;
}

export function UserContextMenu({ target, x, y, onClose, onStartChat }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const currentUser = useAuthStore((s) => s.user);
  const isMe = target.id === currentUser?.id;

  const [pos, setPos] = useState({ x, y });
  // Position adjustment
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const nx = x + rect.width > window.innerWidth ? window.innerWidth - rect.width - 8 : x;
      const ny = y + rect.height > window.innerHeight ? window.innerHeight - rect.height - 8 : y;
      setPos({ x: nx, y: ny });
    }
  }, [x, y]);

  // Close on click outside or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const handleMessage = async () => {
    if (onStartChat) {
      onStartChat(target.id);
      onClose();
      return;
    }
    try {
      const channel = await api.createDM(target.id);
      window.dispatchEvent(new CustomEvent('valhalla:open-dm', {
        detail: { channelId: channel.id, recipientName: target.display_name || target.username },
      }));
      toast.success(`DM mit ${target.display_name || target.username} geoeffnet`);
      onClose();
    } catch {
      toast.error('DM konnte nicht erstellt werden');
    }
  };

  const handleFriendRequest = async () => {
    try {
      await api.sendFriendRequest(target.username);
      toast.success('Freundschaftsanfrage gesendet');
    } catch {
      toast.error('Anfrage fehlgeschlagen');
    }
    onClose();
  };

  const handleBlock = async () => {
    try {
      await api.blockUser(target.id);
      toast.success('Benutzer blockiert');
    } catch {
      toast.error('Fehler');
    }
    onClose();
  };

  const copyUsername = () => {
    navigator.clipboard.writeText(target.username);
    toast.success('Benutzername kopiert');
    onClose();
  };

  const avatarUser: UserAvatarUser = {
    id: target.id,
    username: target.username,
    display_name: target.display_name,
    avatar: target.avatar,
  };

  type MenuItem = { label: string; icon: string; onClick: () => void; danger?: boolean; separator?: boolean; hidden?: boolean };
  const items: MenuItem[] = [
    { label: 'Nachricht senden', icon: '\u{1F4AC}', onClick: handleMessage, hidden: isMe },
    { label: 'Freundschaftsanfrage', icon: '\u{2795}', onClick: handleFriendRequest, separator: true, hidden: isMe },
    { label: 'Blockieren', icon: '\u{1F6AB}', onClick: handleBlock, hidden: isMe, danger: true },
    { label: 'Benutzername kopieren', icon: '\u{1F4CB}', onClick: copyUsername, separator: true },
  ];

  const visibleItems = items.filter(i => !i.hidden);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={`Menu for ${target.display_name}`}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        zIndex: 9999,
        background: 'var(--color-voice-surface)',
        border: '1px solid var(--color-voice-border)',
        borderRadius: 8,
        padding: '0.35rem',
        minWidth: 200,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        animation: 'fadeIn 100ms ease-out',
      }}
    >
      {/* User header */}
      <div style={{
        padding: '0.5rem 0.6rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        borderBottom: '1px solid var(--color-voice-border)',
        marginBottom: '0.2rem',
      }}>
        <UserAvatar user={avatarUser} size={32} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {target.display_name || target.username}
          </div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>@{target.username}</div>
        </div>
      </div>

      {visibleItems.map((item, i) => (
        <div key={i}>
          {item.separator && i > 0 && <div style={{ height: 1, background: 'var(--color-voice-border)', margin: '0.2rem 0.3rem' }} />}
          <button
            role="menuitem"
            onClick={item.onClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              width: '100%',
              padding: '0.4rem 0.5rem',
              borderRadius: 4,
              border: 'none',
              cursor: 'pointer',
              background: 'transparent',
              color: item.danger ? 'var(--color-voice-dnd)' : 'var(--color-voice-text)',
              fontSize: '0.78rem',
              textAlign: 'left',
              fontWeight: 500,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = item.danger
                ? 'rgba(237,66,69,0.1)'
                : 'rgba(88,101,242,0.15)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <span style={{ fontSize: '0.9rem', width: 20, textAlign: 'center' }}>{item.icon}</span>
            {item.label}
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}

/** Hook for managing user context menu state */
export function useUserContextMenu() {
  const [menu, setMenu] = useState<{ target: UserTarget; x: number; y: number } | null>(null);

  const openMenu = useCallback((e: React.MouseEvent, target: UserTarget) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ target, x: e.clientX, y: e.clientY });
  }, []);

  const closeMenu = useCallback(() => setMenu(null), []);

  return { menu, openMenu, closeMenu };
}
