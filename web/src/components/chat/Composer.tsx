import { useCallback, useRef, useState } from 'react';
import { api } from '../../api/client';
import { EmojiPicker } from './EmojiPicker';
import { GifPicker } from './GifPicker';

interface Props {
  channelId: string;
  channelName: string;
  onTyping: () => void;
  replyToId?: string;
  onReplySent?: () => void;
}

export function Composer({ channelId, channelName, onTyping, replyToId, onReplySent }: Props) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const msg = await api.sendMessage(channelId, text, replyToId);
      // Optimistic UI: add message to store immediately
      const { addMessage } = (await import('../../stores/app')).useAppStore.getState();
      addMessage(msg);
      setInput('');
      if (onReplySent) onReplySent();
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err) {
      console.error('Failed to send:', err);
    } finally {
      setSending(false);
    }
  }, [channelId, input, sending]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (e.target.value.length > 0) onTyping();

    // Auto-resize textarea
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  };

  const insertEmoji = (emoji: string) => {
    setInput((prev) => prev + emoji);
    setShowEmoji(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="composer-wrapper">
      {/* Emoji picker */}
      {showEmoji && (
        <EmojiPicker
          onSelect={insertEmoji}
          onClose={() => setShowEmoji(false)}
        />
      )}

      {/* GIF picker */}
      {showGif && (
        <GifPicker
          onSelect={(url) => {
            // Send GIF URL as message
            api.sendMessage(channelId, url, replyToId);
            if (onReplySent) onReplySent();
          }}
          onClose={() => setShowGif(false)}
        />
      )}

      <div className="composer">
        {/* Emoji toggle */}
        <button
          className="composer-action"
          onClick={() => { setShowEmoji(!showEmoji); setShowGif(false); }}
          title="Emoji"
          type="button"
        >
          😀
        </button>

        {/* GIF toggle */}
        <button
          className="composer-action"
          onClick={() => { setShowGif(!showGif); setShowEmoji(false); }}
          title="GIF"
          type="button"
          style={{ fontSize: 12, fontWeight: 700 }}
        >
          GIF
        </button>

        {/* File upload */}
        <label className="composer-action" title="Datei hochladen" style={{ cursor: 'pointer' }}>
          📎
          <input
            type="file"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                // TODO: Upload file via API and attach to message
                alert(`Datei "${file.name}" ausgewaehlt (Upload kommt bald)`);
              }
              e.target.value = '';
            }}
          />
        </label>

        {/* Text input */}
        <textarea
          ref={textareaRef}
          className="composer-input"
          placeholder={`Nachricht an #${channelName}`}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          maxLength={4000}
          rows={1}
          autoFocus
        />

        {/* Send button */}
        <button
          className={`composer-send ${input.trim() ? 'active' : ''}`}
          onClick={handleSend}
          disabled={!input.trim() || sending}
          title="Senden (Enter)"
          type="button"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
