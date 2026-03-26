import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../stores/app';
import { api } from '../../api/client';
import { TypingIndicator } from './TypingIndicator';
import { Markdown } from './Markdown';
import { Composer } from './Composer';
import { MessageActions } from './MessageActions';
import { KanbanBoard } from '../kanban/KanbanBoard';
import { WikiView } from '../wiki/WikiView';
import { SearchPanel } from './SearchPanel';
import { toast } from '../../stores/toast';
import type { Message } from '../../api/client';

interface Props {
  channelId: string;
}

export function ChatView({ channelId }: Props) {
  const { messages, loadMessages, channels, selectedGuildId } = useAppStore();
  const channelMessages = messages.get(channelId) || [];
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [viewMode, setViewMode] = useState<'chat' | 'board' | 'wiki'>('chat');
  const [showSearch, setShowSearch] = useState(false);

  const guildChannels = channels.get(selectedGuildId || '') || [];
  const channel = guildChannels.find((c) => c.id === channelId);

  useEffect(() => {
    loadMessages(channelId);
  }, [channelId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [channelMessages.length]);

  // Clear reply/edit on channel switch
  useEffect(() => {
    setReplyTo(null);
    setEditingMsg(null);
    setShowSearch(false);
  }, [channelId]);

  // Ctrl+K to toggle search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const lastTypingSent = useRef(0);
  const sendTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSent.current > 10000) {
      lastTypingSent.current = now;
      api.sendTyping(channelId).catch(() => {});
    }
  }, [channelId]);

  return (
    <main className="chat-area" id="main-content">
      <header className="chat-header">
        <button
          className="mobile-menu-btn"
          onClick={() => document.querySelector('.app-layout')?.classList.toggle('show-channels')}
          aria-label="Kanäle anzeigen"
        >
          ☰
        </button>
        <span className="hash">#</span>
        {channel?.name || 'unknown'}
        {channel?.topic && (
          <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 14, marginLeft: 8 }}>
            {channel.topic}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button className={`friends-tab ${viewMode === 'chat' ? 'active' : ''}`} onClick={() => setViewMode('chat')}>Chat</button>
          <button className={`friends-tab ${viewMode === 'board' ? 'active' : ''}`} onClick={() => setViewMode('board')}>📋 Board</button>
          <button className={`friends-tab ${viewMode === 'wiki' ? 'active' : ''}`} onClick={() => setViewMode('wiki')}>📖 Wiki</button>
          <button
            className={`friends-tab ${showSearch ? 'active' : ''}`}
            onClick={() => setShowSearch(!showSearch)}
            title="Suche (Strg+K)"
            aria-label="Nachrichten durchsuchen"
          >
            🔍
          </button>
        </div>
      </header>

      {/* Board view */}
      {viewMode === 'board' && selectedGuildId && (
        <KanbanBoard channelId={channelId} guildId={selectedGuildId} />
      )}

      {/* Wiki view */}
      {viewMode === 'wiki' && selectedGuildId && (
        <WikiView guildId={selectedGuildId} />
      )}

      {/* Chat view */}
      {viewMode === 'chat' && <>
      <div className="messages-container" role="log" aria-live="polite" aria-label="Nachrichten">
        {channelMessages.length === 0 ? (
          <div className="empty-state">
            <h2>Willkommen in #{channel?.name}</h2>
            <p>Das ist der Anfang von #{channel?.name}. Schreibe die erste Nachricht!</p>
          </div>
        ) : (
          channelMessages.map((msg, i) => (
            <MessageActions
              key={msg.id}
              message={msg}
              channelId={channelId}
              onReply={(m) => setReplyTo(m)}
              onEdit={(m) => setEditingMsg(m)}
            >
              <MessageItem
                message={msg}
                showHeader={shouldShowHeader(channelMessages, i)}
                isEditing={editingMsg?.id === msg.id}
                onEditDone={() => setEditingMsg(null)}
                channelId={channelId}
              />
            </MessageActions>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <TypingIndicator channelId={channelId} />

      {/* Reply banner */}
      {replyTo && (
        <div className="reply-banner">
          <span>Antwort an <strong>{replyTo.author.display_name || replyTo.author.username}</strong></span>
          <button onClick={() => setReplyTo(null)}>✕</button>
        </div>
      )}

      <Composer
        channelId={channelId}
        channelName={channel?.name || ''}
        onTyping={sendTyping}
        replyToId={replyTo?.id}
        onReplySent={() => setReplyTo(null)}
      />
      </>}

      {/* Search panel */}
      {showSearch && selectedGuildId && (
        <SearchPanel guildId={selectedGuildId} onClose={() => setShowSearch(false)} />
      )}
    </main>
  );
}

function MessageItem({ message, showHeader, isEditing, onEditDone, channelId }: {
  message: Message; showHeader: boolean; isEditing: boolean;
  onEditDone: () => void; channelId: string;
}) {
  const [editText, setEditText] = useState(message.content);

  const saveEdit = async () => {
    if (editText.trim() === message.content) {
      onEditDone();
      return;
    }
    try {
      await api.editMessage(channelId, message.id, editText.trim());
      onEditDone();
    } catch {
      toast.error('Nachricht konnte nicht bearbeitet werden');
    }
  };

  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isReply = message.type === 19 && message.message_reference;

  const content = isEditing ? (
    <div className="msg-edit-wrapper">
      <textarea
        className="msg-edit-input"
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
          if (e.key === 'Escape') onEditDone();
        }}
        autoFocus
      />
      <div className="msg-edit-hint">Escape = Abbrechen, Enter = Speichern</div>
    </div>
  ) : (
    <div className="message-content"><Markdown content={message.content} /></div>
  );

  // Attachments
  const attachments = message.attachments && message.attachments.length > 0 ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
      {message.attachments.map((att) => {
        const isImage = att.content_type?.startsWith('image/');
        if (isImage) {
          return (
            <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer">
              <img
                src={att.url}
                alt={att.filename}
                style={{ maxWidth: 400, maxHeight: 300, borderRadius: 4, display: 'block' }}
              />
            </a>
          );
        }
        return (
          <a
            key={att.id}
            href={att.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 4,
              color: 'var(--text-link)', textDecoration: 'none', fontSize: 14,
              maxWidth: 400,
            }}
          >
            <span>📄</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.filename}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: 12, flexShrink: 0 }}>
              {att.size < 1024 ? `${att.size} B` : att.size < 1024 * 1024 ? `${(att.size / 1024).toFixed(1)} KB` : `${(att.size / 1024 / 1024).toFixed(1)} MB`}
            </span>
          </a>
        );
      })}
    </div>
  ) : null;

  // Reactions
  const reactions = message.reactions && message.reactions.length > 0 ? (
    <div className="msg-reactions">
      {message.reactions.map((r) => (
        <button
          key={r.emoji}
          className={`msg-reaction ${r.me ? 'me' : ''}`}
          onClick={() => {
            if (r.me) {
              api.removeReaction(channelId, message.id, r.emoji).catch(() => toast.error('Reaktion konnte nicht entfernt werden'));
            } else {
              api.addReaction(channelId, message.id, r.emoji).catch(() => toast.error('Reaktion konnte nicht hinzugefügt werden'));
            }
          }}
        >
          {r.emoji} {r.count}
        </button>
      ))}
    </div>
  ) : null;

  if (!showHeader) {
    return (
      <div className={`message ${isEditing ? 'editing' : ''}`} style={{ paddingLeft: 56 }}>
        <div className="message-body">
          {content}
          {attachments}
          {reactions}
        </div>
      </div>
    );
  }

  return (
    <div className={`message ${isEditing ? 'editing' : ''}`}>
      <div className="message-avatar">
        {message.author.username[0].toUpperCase()}
      </div>
      <div className="message-body">
        {isReply && (
          <div className="msg-reply-ref">
            ↩️ <span className="msg-reply-author">Antwort</span>
          </div>
        )}
        <div className="message-header">
          <span className="message-author">{message.author.display_name || message.author.username}</span>
          <span className="message-timestamp">{time}</span>
          {message.edited_timestamp && <span className="message-edited">(bearbeitet)</span>}
        </div>
        {content}
        {attachments}
        {reactions}
      </div>
    </div>
  );
}

function shouldShowHeader(messages: Message[], index: number): boolean {
  if (index === 0) return true;
  const prev = messages[index - 1];
  const curr = messages[index];
  if (prev.author.id !== curr.author.id) return true;
  const diff = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
  return diff > 7 * 60 * 1000;
}
