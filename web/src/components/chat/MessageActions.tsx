import { useEffect, useRef, useState } from 'react';
import { ContextMenu, useContextMenu, MenuItem } from '../common/ContextMenu';
import { api, Message } from '../../api/client';
import { useAuthStore } from '../../stores/auth';
import { useAppStore } from '../../stores/app';
import { EmojiPicker } from './EmojiPicker';
import { toast } from '../../stores/toast';

interface Props {
  message: Message;
  channelId: string;
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  children: React.ReactNode;
}

export function MessageActions({ message, channelId, onReply, onEdit, children }: Props) {
  const { user } = useAuthStore();
  const { removeMessage } = useAppStore();
  const ctx = useContextMenu();
  const [showHover, setShowHover] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const isAuthor = user?.id === message.author.id;

  const menuItems: MenuItem[] = [
    { label: 'Antworten', icon: '↩️', onClick: () => onReply(message) },
    { label: 'Reaktion hinzufügen', icon: '😀', onClick: () => setShowReactionPicker(true) },
    { label: 'Nachricht pinnen', icon: '📌', onClick: () => pinMsg(channelId, message.id) },
    { label: 'Link kopieren', icon: '🔗', onClick: () => copyMessageLink(channelId, message.id) },
    ...(isAuthor ? [
      { separator: true },
      { label: 'Bearbeiten', icon: '✏️', onClick: () => onEdit(message) },
      { label: 'Löschen', icon: '🗑️', danger: true, onClick: () => deleteMessage(channelId, message.id, removeMessage) },
    ] : []),
  ];

  const handleAddReaction = (emoji: string) => {
    api.addReaction(channelId, message.id, emoji).catch(() => toast.error('Reaktion fehlgeschlagen'));
    setShowReactionPicker(false);
  };

  // Close reaction picker on click outside
  useEffect(() => {
    if (!showReactionPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowReactionPicker(false);
      }
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowReactionPicker(false);
    };
    // Delay to avoid immediate close from the click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
      document.addEventListener('keydown', escHandler);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', escHandler);
    };
  }, [showReactionPicker]);

  return (
    <div
      onContextMenu={(e) => ctx.show(e, menuItems)}
      onMouseEnter={() => setShowHover(true)}
      onMouseLeave={() => {
        setShowHover(false);
        // Don't close reaction picker on mouse leave — it closes via click-outside
      }}
      style={{ position: 'relative' }}
    >
      {/* Hover action bar (top right of message) */}
      {(showHover || showReactionPicker) && (
        <div className="msg-action-bar">
          <button onClick={() => onReply(message)} title="Antworten">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); setShowReactionPicker(!showReactionPicker); }} title="Reaktion">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
          </button>
          {isAuthor && <button onClick={() => onEdit(message)} title="Bearbeiten">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>}
          <button onClick={(e) => ctx.show(e as any, menuItems)} title="Mehr">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="5" cy="12" r="2"/></svg>
          </button>
        </div>
      )}

      {/* Emoji picker for reactions — rendered as fixed overlay so it doesn't get clipped */}
      {showReactionPicker && (
        <div
          ref={pickerRef}
          style={{
            position: 'fixed',
            zIndex: 9999,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <EmojiPicker
            onSelect={handleAddReaction}
            onClose={() => setShowReactionPicker(false)}
          />
        </div>
      )}

      {children}

      {ctx.menu && (
        <ContextMenu x={ctx.menu.x} y={ctx.menu.y} items={ctx.menu.items} onClose={ctx.close} />
      )}
    </div>
  );
}

function pinMsg(channelId: string, messageId: string) {
  api.pinMessage(channelId, messageId)
    .then(() => toast.success('Nachricht gepinnt'))
    .catch(() => toast.error('Pinnen fehlgeschlagen'));
}

function copyMessageLink(channelId: string, messageId: string) {
  navigator.clipboard.writeText(`${window.location.origin}/channels/${channelId}/${messageId}`);
  toast.success('Link kopiert');
}

async function deleteMessage(channelId: string, messageId: string, removeFromStore: (cid: string, mid: string) => void) {
  if (!confirm('Nachricht wirklich löschen?')) return;
  try {
    await api.deleteMessage(channelId, messageId);
    removeFromStore(channelId, messageId);
  } catch {
    toast.error('Löschen fehlgeschlagen');
  }
}
