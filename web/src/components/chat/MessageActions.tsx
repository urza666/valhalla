import { useState } from 'react';
import { ContextMenu, useContextMenu, MenuItem } from '../common/ContextMenu';
import { api, Message } from '../../api/client';
import { useAuthStore } from '../../stores/auth';
import { useAppStore } from '../../stores/app';

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

  const isAuthor = user?.id === message.author.id;

  const menuItems: MenuItem[] = [
    { label: 'Antworten', icon: '↩️', onClick: () => onReply(message) },
    { label: 'Reaktion hinzufuegen', icon: '😀', onClick: () => addQuickReaction(channelId, message.id) },
    { label: 'Nachricht pinnen', icon: '📌', onClick: () => pinMessage(channelId, message.id) },
    { label: 'Link kopieren', icon: '🔗', onClick: () => copyMessageLink(channelId, message.id) },
    ...(isAuthor ? [
      { separator: true },
      { label: 'Bearbeiten', icon: '✏️', onClick: () => onEdit(message) },
      { label: 'Loeschen', icon: '🗑️', danger: true, onClick: () => deleteMessage(channelId, message.id, removeMessage) },
    ] : []),
  ];

  return (
    <div
      onContextMenu={(e) => ctx.show(e, menuItems)}
      onMouseEnter={() => setShowHover(true)}
      onMouseLeave={() => setShowHover(false)}
      style={{ position: 'relative' }}
    >
      {/* Hover action bar (top right of message) */}
      {showHover && (
        <div className="msg-action-bar">
          <button onClick={() => onReply(message)} title="Antworten">↩️</button>
          <button onClick={() => addQuickReaction(channelId, message.id)} title="Reaktion">😀</button>
          {isAuthor && <button onClick={() => onEdit(message)} title="Bearbeiten">✏️</button>}
          <button onClick={(e) => ctx.show(e as any, menuItems)} title="Mehr">⋯</button>
        </div>
      )}

      {children}

      {ctx.menu && (
        <ContextMenu x={ctx.menu.x} y={ctx.menu.y} items={ctx.menu.items} onClose={ctx.close} />
      )}
    </div>
  );
}

function addQuickReaction(channelId: string, messageId: string) {
  api.addReaction(channelId, messageId, '👍');
}

function pinMessage(channelId: string, messageId: string) {
  fetch(`/api/v1/channels/${channelId}/messages/${messageId}/ack`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
}

function copyMessageLink(channelId: string, messageId: string) {
  navigator.clipboard.writeText(`${window.location.origin}/channels/${channelId}/${messageId}`);
}

async function deleteMessage(channelId: string, messageId: string, removeFromStore: (cid: string, mid: string) => void) {
  if (!confirm('Nachricht wirklich loeschen?')) return;
  try {
    await api.deleteMessage(channelId, messageId);
    removeFromStore(channelId, messageId);
  } catch { /* ignore */ }
}
