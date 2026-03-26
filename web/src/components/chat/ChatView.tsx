import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../../stores/app';
import { api } from '../../api/client';
import { TypingIndicator } from './TypingIndicator';
import { Markdown } from './Markdown';
import { Composer } from './Composer';
import type { Message } from '../../api/client';

interface Props {
  channelId: string;
}

export function ChatView({ channelId }: Props) {
  const { messages, loadMessages, channels, selectedGuildId } = useAppStore();
  const channelMessages = messages.get(channelId) || [];
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const guildChannels = channels.get(selectedGuildId || '') || [];
  const channel = guildChannels.find((c) => c.id === channelId);

  useEffect(() => {
    loadMessages(channelId);
  }, [channelId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [channelMessages.length]);

  // Typing indicator throttle
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
      </div>

      <div className="messages-container">
        {channelMessages.length === 0 ? (
          <div className="empty-state">
            <h2>Willkommen in #{channel?.name}</h2>
            <p>Das ist der Anfang des Kanals. Schreibe die erste Nachricht!</p>
          </div>
        ) : (
          channelMessages.map((msg, i) => (
            <MessageItem key={msg.id} message={msg} showHeader={shouldShowHeader(channelMessages, i)} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <TypingIndicator channelId={channelId} />

      <Composer
        channelId={channelId}
        channelName={channel?.name || ''}
        onTyping={sendTyping}
      />
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

function shouldShowHeader(messages: Message[], index: number): boolean {
  if (index === 0) return true;
  const prev = messages[index - 1];
  const curr = messages[index];
  if (prev.author.id !== curr.author.id) return true;
  const diff = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
  return diff > 7 * 60 * 1000;
}
