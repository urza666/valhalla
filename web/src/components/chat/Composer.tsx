import { useCallback, useRef, useState } from 'react';
import { api } from '../../api/client';
import { EmojiPicker } from './EmojiPicker';
import { GifPicker } from './GifPicker';
import { toast } from '../../stores/toast';
import type { Attachment } from '../../api/client';

interface PendingFile {
  file: File;
  name: string;
  uploading: boolean;
  attachmentId?: string;
  error?: string;
}

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
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const uploadFile = async (file: File) => {
    const pf: PendingFile = { file, name: file.name, uploading: true };
    setPendingFiles((prev) => [...prev, pf]);

    try {
      const att: Attachment = await api.uploadAttachment(channelId, file);
      setPendingFiles((prev) =>
        prev.map((f) => f.name === file.name && f.uploading ? { ...f, uploading: false, attachmentId: att.id } : f)
      );
    } catch {
      setPendingFiles((prev) =>
        prev.map((f) => f.name === file.name && f.uploading ? { ...f, uploading: false, error: 'Upload fehlgeschlagen' } : f)
      );
    }
  };

  const removePendingFile = (name: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const handleSend = useCallback(async () => {
    const text = input.trim();
    const readyAttachments = pendingFiles.filter((f) => f.attachmentId && !f.error);
    if ((!text && readyAttachments.length === 0) || sending) return;
    setSending(true);
    try {
      let msg;
      if (readyAttachments.length > 0) {
        const attIds = readyAttachments.map((f) => f.attachmentId!);
        msg = await api.sendMessageWithAttachments(channelId, text || '', attIds, replyToId);
      } else {
        msg = await api.sendMessage(channelId, text, replyToId);
      }
      const { addMessage } = (await import('../../stores/app')).useAppStore.getState();
      addMessage(msg);
      setInput('');
      setPendingFiles([]);
      if (onReplySent) onReplySent();
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch {
      toast.error('Nachricht konnte nicht gesendet werden');
    } finally {
      setSending(false);
    }
  }, [channelId, input, sending, pendingFiles]);

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

      {/* Pending file previews */}
      {pendingFiles.length > 0 && (
        <div style={{
          display: 'flex', gap: 8, padding: '8px 4px', flexWrap: 'wrap',
          background: 'var(--bg-tertiary)', borderRadius: '8px 8px 0 0', marginBottom: -1,
        }}>
          {pendingFiles.map((pf) => (
            <div key={pf.name} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
              background: 'var(--bg-secondary)', borderRadius: 4, fontSize: 13,
              color: pf.error ? 'var(--danger)' : 'var(--text-secondary)',
            }}>
              {pf.uploading && <div className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
              {pf.error ? '⚠️' : pf.attachmentId ? '📄' : ''}
              <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pf.name}
              </span>
              <button
                onClick={() => removePendingFile(pf.name)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: 0 }}
              >×</button>
            </div>
          ))}
        </div>
      )}

      <div className="composer">
        {/* Emoji toggle */}
        <button
          className="composer-action"
          onClick={() => { setShowEmoji(!showEmoji); setShowGif(false); }}
          title="Emoji"
          aria-label="Emoji-Auswahl öffnen"
          type="button"
        >
          😀
        </button>

        {/* GIF toggle */}
        <button
          className="composer-action"
          onClick={() => { setShowGif(!showGif); setShowEmoji(false); }}
          title="GIF"
          aria-label="GIF-Auswahl öffnen"
          type="button"
          style={{ fontSize: 12, fontWeight: 700 }}
        >
          GIF
        </button>

        {/* File upload */}
        <label className="composer-action" title="Datei hochladen" aria-label="Datei hochladen" style={{ cursor: 'pointer' }}>
          📎
          <input
            type="file"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                if (file.size > 25 * 1024 * 1024) {
                  alert('Datei zu groß (max. 25 MB)');
                } else {
                  uploadFile(file);
                }
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
