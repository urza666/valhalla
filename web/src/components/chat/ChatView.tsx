import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../stores/app';
import { api } from '../../api/client';
import { TypingIndicator } from './TypingIndicator';
import { Markdown } from './Markdown';
import type { Message } from '../../api/client';

interface Props {
  channelId: string;
}

export function ChatView({ channelId }: Props) {
  const { messages, loadMessages, channels, selectedGuildId } = useAppStore();
  const channelMessages = messages.get(channelId) || [];
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get channel name
  const guildChannels = channels.get(selectedGuildId || '') || [];
  const channel = guildChannels.find((c) => c.id === channelId);

  useEffect(() => {
    loadMessages(channelId);
  }, [channelId, loadMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [channelMessages.length]);

  // Typing indicator throttle (send at most every 10s)
  const lastTypingSent = useRef(0);
  const sendTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSent.current > 10000) {
      lastTypingSent.current = now;
      api.sendTyping(channelId).catch(() => {});
    }
  }, [channelId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    setSending(true);
    try {
      await api.sendMessage(channelId, input.trim());
      setInput('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

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
      </div>

      <div className="messages-container">
        {channelMessages.length === 0 ? (
          <div className="empty-state">
            <h2>Welcome to #{channel?.name}</h2>
            <p>This is the beginning of the channel.</p>
          </div>
        ) : (
          channelMessages.map((msg, i) => (
            <MessageItem key={msg.id} message={msg} showHeader={shouldShowHeader(channelMessages, i)} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <TypingIndicator channelId={channelId} />

      <form className="composer" onSubmit={handleSend}>
        <input
          className="composer-input"
          placeholder={`Message #${channel?.name || ''}`}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (e.target.value.length > 0) sendTyping();
          }}
          onKeyDown={handleKeyDown}
          maxLength={4000}
          autoFocus
        />
      </form>
    </div>
  );
}

function MessageItem({ message, showHeader }: { message: Message; showHeader: boolean }) {
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (!showHeader) {
    return (
      <div className="message" style={{ paddingLeft: 56 }}>
        <div className="message-body">
          <div className="message-content"><Markdown content={message.content} /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="message">
      <div className="message-avatar">
        {message.author.username[0].toUpperCase()}
      </div>
      <div className="message-body">
        <div className="message-header">
          <span className="message-author">{message.author.display_name || message.author.username}</span>
          <span className="message-timestamp">{time}</span>
        </div>
        <div className="message-content"><Markdown content={message.content} /></div>
      </div>
    </div>
  );
}

// Group messages from same author within 7 minutes
function shouldShowHeader(messages: Message[], index: number): boolean {
  if (index === 0) return true;
  const prev = messages[index - 1];
  const curr = messages[index];
  if (prev.author.id !== curr.author.id) return true;
  const diff = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
  return diff > 7 * 60 * 1000;
}
