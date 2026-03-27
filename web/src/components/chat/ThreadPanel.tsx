/**
 * ThreadPanel — Thread sidebar for message replies.
 * Ported from LPP, adapted for Valhalla Go API.
 * Uses channels/{channelId}/messages with message_reference for threading.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../../api/client';
import { useAppStore } from '../../stores/app';
import { UserAvatar } from '../common/UserAvatar';
import { Markdown } from './Markdown';
import { toast } from '../../stores/toast';
import type { Message } from '../../api/client';

interface ThreadPanelProps {
  message: Message;
  channelId: string;
  onClose: () => void;
}

export function ThreadPanel({ message, channelId, onClose }: ThreadPanelProps) {
  const [replies, setReplies] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load thread replies — messages that reference this message
  const loadReplies = useCallback(async () => {
    try {
      const allMessages = await api.getMessages(channelId, undefined, 100);
      const threadMsgs = allMessages.filter((m) => m.message_reference === message.id);
      setReplies(threadMsgs);
    } catch {
      setReplies([]);
    }
    setLoading(false);
  }, [channelId, message.id]);

  useEffect(() => {
    loadReplies();
  }, [loadReplies]);

  // Listen for new messages from WebSocket
  useEffect(() => {
    const msgs = useAppStore.getState().messages.get(channelId) || [];
    const threadMsgs = msgs.filter((m) => m.message_reference === message.id);
    if (threadMsgs.length > replies.length) {
      setReplies(threadMsgs);
    }
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies.length]);

  const handleSend = useCallback(async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      const msg = await api.sendMessage(channelId, reply.trim(), message.id);
      useAppStore.getState().addMessage(msg);
      setReplies((prev) => [...prev, msg]);
      setReply('');
    } catch {
      toast.error('Antwort konnte nicht gesendet werden');
    }
    setSending(false);
  }, [reply, sending, channelId, message.id]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') onClose();
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{
      width: 360,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--color-voice-surface-modal, var(--bg-tertiary))',
      borderLeft: '1px solid var(--color-voice-border, var(--color-border))',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '0.75rem 1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--color-voice-border, var(--color-border))',
      }}>
        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
          Thread
          <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
            {replies.length} {replies.length === 1 ? 'Antwort' : 'Antworten'}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            cursor: 'pointer', fontSize: '1.1rem', padding: 4,
          }}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Thread content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0.75rem' }}>
        {loading && <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Laden...</div>}

        {/* Root message */}
        <div style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--color-voice-border, var(--color-border))', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <UserAvatar
              user={{ username: message.author.username, display_name: message.author.display_name, avatar: message.author.avatar }}
              size={36}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                  {message.author.display_name || message.author.username}
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  {formatTime(message.timestamp)}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.5, wordBreak: 'break-word' }}>
                <Markdown content={message.content} />
              </div>
            </div>
          </div>
        </div>

        {/* Replies */}
        {replies.map((r) => (
          <div key={r.id} style={{ padding: '0.35rem 0', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <UserAvatar
              user={{ username: r.author.username, display_name: r.author.display_name, avatar: r.author.avatar }}
              size={28}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                <span style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                  {r.author.display_name || r.author.username}
                </span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                  {formatTime(r.timestamp)}
                </span>
                {r.edited_timestamp && <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>(bearbeitet)</span>}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 1, lineHeight: 1.45, wordBreak: 'break-word' }}>
                <Markdown content={r.content} />
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Reply input */}
      <div style={{
        padding: '0.5rem 0.75rem',
        borderTop: '1px solid var(--color-voice-border, var(--color-border))',
        display: 'flex',
        gap: 6,
      }}>
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="In Thread antworten..."
          rows={1}
          style={{
            flex: 1, resize: 'none',
            border: '1px solid var(--color-voice-border, var(--color-border))',
            borderRadius: 8,
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            padding: '0.4rem 0.6rem',
            fontSize: '0.78rem',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!reply.trim() || sending}
          style={{
            background: 'var(--brand-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '0 0.75rem',
            cursor: 'pointer',
            opacity: reply.trim() ? 1 : 0.4,
            fontSize: '0.78rem',
            fontWeight: 600,
          }}
        >
          {sending ? '...' : 'Senden'}
        </button>
      </div>
    </div>
  );
}
