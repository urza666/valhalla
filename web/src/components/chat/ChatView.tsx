import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../stores/app';
import { api } from '../../api/client';
import { TypingIndicator } from './TypingIndicator';
import { Markdown } from './Markdown';
import { Composer } from './Composer';
import { MessageActions } from './MessageActions';
import { KanbanBoard } from '../kanban/KanbanBoard';
import { WikiView } from '../wiki/WikiView';
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
  }, [channelId]);

  const lastTypingSent = useRef(0);
  const sendTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSent.current > 10000) {
      lastTypingSent.current = now;
      api.sendTyping(channelId).catch(() => {});
    }
  }, [channelId]);

  return (
    <div className="chat-area">
      <div className="chat-header">
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
        </div>
      </div>

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
      <div className="messages-container">
        {channelMessages.length === 0 ? (
          <div className="empty-state">
            <h2>Willkommen in #{channel?.name}</h2>
            <p>Das ist der Anfang des Kanals. Schreibe die erste Nachricht!</p>
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
    </div>
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
    } catch { /* ignore */ }
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

  // Reactions
  const reactions = message.reactions && message.reactions.length > 0 ? (
    <div className="msg-reactions">
      {message.reactions.map((r) => (
        <button
          key={r.emoji}
          className={`msg-reaction ${r.me ? 'me' : ''}`}
          onClick={() => {
            if (r.me) {
              api.removeReaction(channelId, message.id, r.emoji);
            } else {
              api.addReaction(channelId, message.id, r.emoji);
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
