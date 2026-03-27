/**
 * MessageComposer — LPP-identical message input with slash commands, emoji, file upload.
 * Uses Valhalla api/client.ts (fetch) + stores.
 */
import { useCallback, useRef, useState } from 'react';
import { api } from '../../api/client';
import { useAppStore } from '../../stores/app';
import { toast } from '../../stores/toast';
import { SLASH_COMMANDS, EMOJI_LIST } from './types';
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

export function MessageComposer({ channelId, channelName, onTyping, replyToId, onReplySent }: Props) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showSlash, setShowSlash] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashIdx, setSlashIdx] = useState(0);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const uploadFile = async (file: File) => {
    const pf: PendingFile = { file, name: file.name, uploading: true };
    setPendingFiles((prev) => [...prev, pf]);
    try {
      const att: Attachment = await api.uploadAttachment(channelId, file);
      setPendingFiles((prev) => prev.map((f) => f.name === file.name && f.uploading ? { ...f, uploading: false, attachmentId: att.id } : f));
    } catch {
      setPendingFiles((prev) => prev.map((f) => f.name === file.name && f.uploading ? { ...f, uploading: false, error: 'Fehlgeschlagen' } : f));
    }
  };

  const executeSlash = useCallback(async (text: string): Promise<boolean> => {
    const parts = text.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    switch (cmd) {
      case '/flip': {
        const r = Math.random() < 0.5 ? 'Kopf' : 'Zahl';
        await api.sendMessage(channelId, `🪙 **Muenzwurf:** ${r}!`, replyToId);
        return true;
      }
      case '/roll': {
        const max = parseInt(args) || 99;
        const r = Math.floor(Math.random() * max) + 1;
        await api.sendMessage(channelId, `🎲 **Wuerfel (1-${max}):** ${r}`, replyToId);
        return true;
      }
      case '/shrug': {
        await api.sendMessage(channelId, args ? `${args} ¯\\_(ツ)_/¯` : '¯\\_(ツ)_/¯', replyToId);
        return true;
      }
      case '/tableflip': {
        await api.sendMessage(channelId, args ? `${args} (╯°□°)╯︵ ┻━┻` : '(╯°□°)╯︵ ┻━┻', replyToId);
        return true;
      }
      case '/unflip': {
        await api.sendMessage(channelId, args ? `${args} ┬─┬ ノ( ゜-゜ノ)` : '┬─┬ ノ( ゜-゜ノ)', replyToId);
        return true;
      }
      case '/lenny': {
        await api.sendMessage(channelId, args ? `${args} ( ͡° ͜ʖ ͡°)` : '( ͡° ͜ʖ ͡°)', replyToId);
        return true;
      }
      case '/me': {
        if (!args) { toast.error('/me braucht eine Aktion'); return false; }
        await api.sendMessage(channelId, `*${args}*`, replyToId);
        return true;
      }
      case '/spoiler': {
        if (!args) { toast.error('/spoiler braucht Text'); return false; }
        await api.sendMessage(channelId, `||${args}||`, replyToId);
        return true;
      }
      default: return false;
    }
  }, [channelId, replyToId]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    const readyAtts = pendingFiles.filter((f) => f.attachmentId);
    if ((!text && readyAtts.length === 0) || sending) return;

    if (text.startsWith('/')) {
      setSending(true);
      try {
        const handled = await executeSlash(text);
        if (handled) {
          setInput(''); setPendingFiles([]); onReplySent?.();
          if (taRef.current) taRef.current.style.height = 'auto';
          setShowSlash(false);
        } else {
          toast.error(`Unbekannter Befehl: ${text.split(/\s/)[0]}`);
        }
      } catch { toast.error('Befehl fehlgeschlagen'); }
      setSending(false);
      return;
    }

    setSending(true);
    try {
      let msg;
      if (readyAtts.length > 0) {
        msg = await api.sendMessageWithAttachments(channelId, text || '', readyAtts.map((f) => f.attachmentId!), replyToId);
      } else {
        msg = await api.sendMessage(channelId, text, replyToId);
      }
      useAppStore.getState().addMessage(msg);
      setInput(''); setPendingFiles([]); onReplySent?.();
      if (taRef.current) taRef.current.style.height = 'auto';
    } catch { toast.error('Nachricht konnte nicht gesendet werden'); }
    setSending(false);
  }, [channelId, input, sending, pendingFiles, executeSlash, replyToId, onReplySent]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    if (val.length > 0) onTyping();

    // Slash autocomplete
    if (val.startsWith('/') && !val.includes(' ')) {
      setSlashFilter(val.slice(1).toLowerCase());
      setShowSlash(true); setSlashIdx(0);
    } else {
      setShowSlash(false);
    }

    // Auto-resize
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSlash) {
      const filtered = getFilteredSlash();
      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashIdx((i) => Math.min(i + 1, filtered.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSlashIdx((i) => Math.max(i - 1, 0)); return; }
      if (e.key === 'Tab' || (e.key === 'Enter' && filtered.length > 0 && input.length <= slashFilter.length + 1)) {
        e.preventDefault();
        const cmd = filtered[slashIdx];
        if (cmd) { setInput(`/${cmd.name} `); setShowSlash(false); taRef.current?.focus(); }
        return;
      }
      if (e.key === 'Escape') { setShowSlash(false); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const getFilteredSlash = () => {
    if (!slashFilter) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter((c) => c.name.startsWith(slashFilter));
  };

  return (
    <div style={{ padding: '0 16px 12px', flexShrink: 0 }}>
      {/* Slash autocomplete */}
      {showSlash && getFilteredSlash().length > 0 && (
        <div style={{
          background: 'var(--color-voice-surface, #1e1f22)',
          border: '1px solid var(--color-voice-border)',
          borderRadius: 8, padding: 4, marginBottom: 4,
          boxShadow: '0 -4px 16px rgba(0,0,0,0.3)',
        }}>
          {getFilteredSlash().map((cmd, i) => (
            <div key={cmd.name}
              style={{
                padding: '6px 10px', borderRadius: 4, cursor: 'pointer',
                background: i === slashIdx ? 'rgba(88,101,242,0.15)' : 'transparent',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}
              onClick={() => { setInput(`/${cmd.name} `); setShowSlash(false); taRef.current?.focus(); }}
              onMouseEnter={() => setSlashIdx(i)}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>/{cmd.name}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{cmd.description}</span>
            </div>
          ))}
        </div>
      )}

      {/* Emoji picker */}
      {showEmoji && (
        <div style={{
          position: 'absolute', bottom: 70, right: 16, zIndex: 50,
          background: 'var(--color-voice-surface, #1e1f22)',
          border: '1px solid var(--color-voice-border)',
          borderRadius: 8, padding: 8,
          boxShadow: '0 -4px 16px rgba(0,0,0,0.4)',
          display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 2,
          maxWidth: 280,
        }}>
          {EMOJI_LIST.map((e) => (
            <button key={e} onClick={() => { setInput((p) => p + e); setShowEmoji(false); taRef.current?.focus(); }}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: 4, borderRadius: 4 }}
              onMouseEnter={(ev) => { (ev.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
              onMouseLeave={(ev) => { (ev.currentTarget as HTMLElement).style.background = 'none'; }}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {/* Pending files */}
      {pendingFiles.length > 0 && (
        <div style={{ display: 'flex', gap: 6, padding: '6px 0', flexWrap: 'wrap' }}>
          {pendingFiles.map((pf) => (
            <div key={pf.name} style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px',
              background: 'var(--color-voice-surface, #1e1f22)', borderRadius: 4, fontSize: 12,
              color: pf.error ? '#ed4245' : 'var(--text-secondary)',
            }}>
              {pf.uploading ? '⏳' : pf.error ? '⚠️' : '📄'}
              <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pf.name}</span>
              <button onClick={() => setPendingFiles((prev) => prev.filter((f) => f.name !== pf.name))}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, padding: 0 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', gap: 4,
        background: 'var(--bg-tertiary, #141920)',
        borderRadius: 8, padding: '4px 8px',
        position: 'relative',
      }}>
        {/* File upload */}
        <label style={{
          padding: 6, cursor: 'pointer', borderRadius: 4,
          color: 'var(--text-muted)', fontSize: 16, display: 'flex', alignItems: 'center',
        }}>
          📎
          <input type="file" style={{ display: 'none' }} onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              if (file.size > 25 * 1024 * 1024) toast.error('Max 25 MB');
              else uploadFile(file);
            }
            e.target.value = '';
          }} />
        </label>

        {/* Emoji button */}
        <button onClick={() => setShowEmoji(!showEmoji)} style={{
          background: 'none', border: 'none', padding: 6, cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 16, display: 'flex', alignItems: 'center',
        }}>😀</button>

        {/* Text input */}
        <textarea
          ref={taRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={`Nachricht an #${channelName} — Tippe / fuer Befehle`}
          maxLength={4000}
          rows={1}
          autoFocus
          style={{
            flex: 1, resize: 'none', border: 'none', outline: 'none',
            background: 'transparent', color: 'var(--text-primary, #dde4ef)',
            fontSize: 14, lineHeight: 1.4, padding: '6px 4px',
            fontFamily: 'inherit', maxHeight: 200,
          }}
        />

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={(!input.trim() && !pendingFiles.some((f) => f.attachmentId)) || sending}
          style={{
            background: (input.trim() || pendingFiles.some((f) => f.attachmentId))
              ? 'var(--brand-primary, #c8a84a)' : 'transparent',
            border: 'none', borderRadius: 4, padding: '6px 10px',
            cursor: 'pointer', color: (input.trim() || pendingFiles.some((f) => f.attachmentId)) ? '#080b0f' : 'var(--text-muted)',
            fontSize: 16, fontWeight: 700, transition: 'all 0.15s',
            display: 'flex', alignItems: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
