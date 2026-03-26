import { useCallback, useRef, useState } from 'react';
import { api } from '../../api/client';

// Common emoji quick picks
const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '👀', '💯', '✅', '❌', '🤔', '😍', '🙌', '💀', '🫡', '👋', '🥳'];

interface Props {
  channelId: string;
  channelName: string;
  onTyping: () => void;
}

export function Composer({ channelId, channelName, onTyping }: Props) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await api.sendMessage(channelId, text);
      setInput('');
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
        <div className="emoji-picker">
          <div className="emoji-picker-grid">
            {QUICK_EMOJIS.map((emoji) => (
              <button key={emoji} className="emoji-btn" onClick={() => insertEmoji(emoji)}>
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="composer">
        {/* Emoji toggle */}
        <button
          className="composer-action"
          onClick={() => setShowEmoji(!showEmoji)}
          title="Emoji"
          type="button"
        >
          😀
        </button>

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
