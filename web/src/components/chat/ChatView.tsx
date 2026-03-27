import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../stores/app';
import { useAuthStore } from '../../stores/auth';
import { api } from '../../api/client';
import { TypingIndicator } from './TypingIndicator';
import { Markdown } from './Markdown';
import { Composer } from './Composer';
import { MessageActions } from './MessageActions';
import { ThreadPanel } from './ThreadPanel';
import { KanbanBoard } from '../kanban/KanbanBoard';
import { WikiView } from '../wiki/WikiView';
import { SearchPanel } from './SearchPanel';
import { UserProfilePopout } from '../common/UserProfilePopout';
import { UserAvatar } from '../common/UserAvatar';
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
  const [showPins, setShowPins] = useState(false);
  const [pins, setPins] = useState<Message[]>([]);
  const [pinsLoading, setPinsLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [threadMsg, setThreadMsg] = useState<Message | null>(null);

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
    setShowPins(false);
    setThreadMsg(null);
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

  // Load pinned messages
  const loadPins = useCallback(async () => {
    setPinsLoading(true);
    try {
      const data = await api.getPins(channelId);
      setPins(Array.isArray(data) ? data : []);
    } catch {
      setPins([]);
      toast.error('Pins konnten nicht geladen werden');
    }
    setPinsLoading(false);
  }, [channelId]);

  const togglePins = () => {
    if (!showPins) loadPins();
    setShowPins(!showPins);
  };

  const lastTypingSent = useRef(0);
  const sendTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSent.current > 10000) {
      lastTypingSent.current = now;
      api.sendTyping(channelId).catch(() => {});
    }
  }, [channelId]);

  // Drag & Drop file upload
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    for (const file of files) {
      if (file.size > 25 * 1024 * 1024) {
        toast.error(`${file.name}: Datei zu groß (max. 25 MB)`);
        continue;
      }
      try {
        const att = await api.uploadAttachment(channelId, file);
        await api.sendMessageWithAttachments(channelId, '', [att.id]);
        toast.success(`${file.name} gesendet`);
      } catch {
        toast.error(`${file.name}: Upload fehlgeschlagen`);
      }
    }
  };

  return (
    <main
      className="chat-area"
      id="main-content"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className="drag-overlay">
          <div className="drag-overlay-inner">
            <div style={{ fontSize: 48 }}>📎</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>Dateien hier ablegen</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Dateien werden in #{channel?.name} gesendet</div>
          </div>
        </div>
      )}

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
          <span className="chat-header-topic">
            {channel.topic}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button className={`friends-tab ${viewMode === 'chat' ? 'active' : ''}`} onClick={() => setViewMode('chat')}>Chat</button>
          <button className={`friends-tab ${viewMode === 'board' ? 'active' : ''}`} onClick={() => setViewMode('board')}>📋</button>
          <button className={`friends-tab ${viewMode === 'wiki' ? 'active' : ''}`} onClick={() => setViewMode('wiki')}>📖</button>
          <button
            className={`friends-tab ${showPins ? 'active' : ''}`}
            onClick={togglePins}
            title="Gepinnte Nachrichten"
          >
            📌
          </button>
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
              onThread={(m) => setThreadMsg(m)}
            >
              <MessageItem
                message={msg}
                showHeader={shouldShowHeader(channelMessages, i)}
                isEditing={editingMsg?.id === msg.id}
                onEditDone={() => setEditingMsg(null)}
                onDoubleClickEdit={() => {
                  if (msg.author.id === useAuthStore.getState().user?.id) {
                    setEditingMsg(msg);
                  }
                }}
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

      {/* Pinned messages panel */}
      {showPins && (
        <div className="search-panel" style={{ animation: 'slideUp 0.2s ease' }}>
          <div className="search-panel-header">
            <span style={{ fontWeight: 600, fontSize: 14 }}>📌 Gepinnte Nachrichten</span>
            <button className="search-close" onClick={() => setShowPins(false)}>x</button>
          </div>
          <div className="search-results">
            {pinsLoading && <div className="search-status">Lade Pins...</div>}
            {!pinsLoading && pins.length === 0 && (
              <div className="search-status">Keine gepinnten Nachrichten</div>
            )}
            {!pinsLoading && pins.map((pin) => (
              <div key={pin.id} className="search-result-item">
                <div className="search-result-meta">
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {pin.author?.display_name || pin.author?.username}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>
                    {new Date(pin.timestamp).toLocaleDateString('de-DE')}
                  </span>
                </div>
                <div className="search-result-content">
                  <Markdown content={pin.content} />
                </div>
                <button
                  className="btn-danger"
                  style={{ marginTop: 4, padding: '4px 10px', fontSize: 12 }}
                  onClick={async () => {
                    try {
                      await api.unpinMessage(channelId, pin.id);
                      setPins(pins.filter(p => p.id !== pin.id));
                      toast.success('Pin entfernt');
                    } catch { toast.error('Entfernen fehlgeschlagen'); }
                  }}
                >
                  Pin entfernen
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search panel */}
      {showSearch && selectedGuildId && (
        <SearchPanel guildId={selectedGuildId} onClose={() => setShowSearch(false)} />
      )}

      {/* Thread panel */}
      {threadMsg && (
        <ThreadPanel
          message={threadMsg}
          channelId={channelId}
          onClose={() => setThreadMsg(null)}
        />
      )}
    </main>
  );
}

function MessageItem({ message, showHeader, isEditing, onEditDone, onDoubleClickEdit, channelId }: {
  message: Message; showHeader: boolean; isEditing: boolean;
  onEditDone: () => void; onDoubleClickEdit: () => void; channelId: string;
}) {
  const [editText, setEditText] = useState(message.content);
  const [authorPopout, setAuthorPopout] = useState<{ x: number; y: number } | null>(null);

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
          title={`${r.count} Reaktion${r.count !== 1 ? 'en' : ''}`}
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
      <div
        className={`message ${isEditing ? 'editing' : ''}`}
        style={{ paddingLeft: 56 }}
        onDoubleClick={onDoubleClickEdit}
      >
        <div className="message-body">
          {content}
          {attachments}
          {reactions}
        </div>
      </div>
    );
  }

  return (
    <div className={`message ${isEditing ? 'editing' : ''}`} onDoubleClick={onDoubleClickEdit}>
      <div className="message-avatar" style={{ background: 'none' }}>
        <UserAvatar
          user={{ username: message.author.username, display_name: message.author.display_name, avatar: message.author.avatar }}
          size={40}
          onClick={(e) => setAuthorPopout({ x: e.clientX, y: e.clientY })}
        />
      </div>
      <div className="message-body">
        {isReply && (
          <div className="msg-reply-ref">
            ↩️ <span className="msg-reply-author">Antwort</span>
          </div>
        )}
        <div className="message-header">
          <span
            className="message-author"
            style={{ cursor: 'pointer' }}
            onClick={(e) => setAuthorPopout({ x: e.clientX, y: e.clientY })}
            title="Profil anzeigen"
          >
            {message.author.display_name || message.author.username}
          </span>
          <span className="message-timestamp">{time}</span>
          {message.edited_timestamp && <span className="message-edited">(bearbeitet)</span>}
        </div>
        {content}
        {attachments}
        {reactions}
      </div>

      {/* Author profile popout */}
      {authorPopout && (
        <UserProfilePopout
          userId={message.author.id}
          x={authorPopout.x}
          y={authorPopout.y}
          onClose={() => setAuthorPopout(null)}
        />
      )}
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
