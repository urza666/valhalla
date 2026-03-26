import { useCallback, useRef, useState } from 'react';
import { api } from '../../api/client';
import { useAppStore } from '../../stores/app';
import { EmojiPicker } from './EmojiPicker';
import { GifPicker } from './GifPicker';
import { CreatePollDialog } from '../poll/PollCard';
import { toast } from '../../stores/toast';
import type { Attachment } from '../../api/client';

interface PendingFile {
  file: File;
  name: string;
  uploading: boolean;
  attachmentId?: string;
  error?: string;
}

// Slash command definitions
interface SlashCommand {
  name: string;
  description: string;
  usage?: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'poll', description: 'Umfrage erstellen', usage: '/poll' },
  { name: 'flip', description: 'Münze werfen (Kopf oder Zahl)', usage: '/flip' },
  { name: 'roll', description: 'Zufallszahl (1-99)', usage: '/roll oder /roll 20' },
  { name: 'shrug', description: '¯\\_(ツ)_/¯ einfügen', usage: '/shrug [Nachricht]' },
  { name: 'tableflip', description: '(╯°□°)╯︵ ┻━┻ einfügen', usage: '/tableflip [Nachricht]' },
  { name: 'unflip', description: '┬─┬ ノ( ゜-゜ノ) einfügen', usage: '/unflip [Nachricht]' },
  { name: 'lenny', description: '( ͡° ͜ʖ ͡°) einfügen', usage: '/lenny [Nachricht]' },
  { name: 'me', description: 'Aktion-Nachricht (*kursiv*)', usage: '/me [Aktion]' },
  { name: 'spoiler', description: 'Spoiler-Nachricht', usage: '/spoiler [Nachricht]' },
  { name: 'nick', description: 'Spitznamen ändern', usage: '/nick [Name]' },
  { name: 'clear', description: 'Chat-Eingabe leeren', usage: '/clear' },
  { name: 'giphy', description: 'GIF suchen', usage: '/giphy [Suchbegriff]' },
];

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
  const [showPoll, setShowPoll] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0);
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

  // Execute a slash command
  const executeSlashCommand = useCallback(async (commandText: string): Promise<boolean> => {
    const parts = commandText.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    switch (cmd) {
      case '/flip': {
        const result = Math.random() < 0.5 ? 'Kopf' : 'Zahl';
        await api.sendMessage(channelId, `🪙 **Münzwurf:** ${result}!`, replyToId);
        return true;
      }

      case '/roll': {
        const max = parseInt(args) || 99;
        const result = Math.floor(Math.random() * max) + 1;
        await api.sendMessage(channelId, `🎲 **Würfel (1-${max}):** ${result}`, replyToId);
        return true;
      }

      case '/shrug': {
        const text = args ? `${args} ¯\\_(ツ)_/¯` : '¯\\_(ツ)_/¯';
        await api.sendMessage(channelId, text, replyToId);
        return true;
      }

      case '/tableflip': {
        const text = args ? `${args} (╯°□°)╯︵ ┻━┻` : '(╯°□°)╯︵ ┻━┻';
        await api.sendMessage(channelId, text, replyToId);
        return true;
      }

      case '/unflip': {
        const text = args ? `${args} ┬─┬ ノ( ゜-゜ノ)` : '┬─┬ ノ( ゜-゜ノ)';
        await api.sendMessage(channelId, text, replyToId);
        return true;
      }

      case '/lenny': {
        const text = args ? `${args} ( ͡° ͜ʖ ͡°)` : '( ͡° ͜ʖ ͡°)';
        await api.sendMessage(channelId, text, replyToId);
        return true;
      }

      case '/me': {
        if (!args) { toast.error('/me erwartet eine Aktion'); return false; }
        await api.sendMessage(channelId, `*${args}*`, replyToId);
        return true;
      }

      case '/spoiler': {
        if (!args) { toast.error('/spoiler erwartet einen Text'); return false; }
        await api.sendMessage(channelId, `||${args}||`, replyToId);
        return true;
      }

      case '/nick': {
        // Would need a PATCH to member endpoint - for now just show info
        toast.info(`Spitzname "${args}" — Funktion kommt bald`);
        return true;
      }

      case '/clear': {
        setInput('');
        return true;
      }

      case '/poll': {
        setShowPoll(true);
        return true;
      }

      case '/giphy': {
        setShowGif(true);
        return true;
      }

      default:
        return false;
    }
  }, [channelId, replyToId]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    const readyAttachments = pendingFiles.filter((f) => f.attachmentId && !f.error);
    if ((!text && readyAttachments.length === 0) || sending) return;

    // Check for slash commands
    if (text.startsWith('/')) {
      setSending(true);
      try {
        const handled = await executeSlashCommand(text);
        if (handled) {
          setInput('');
          setPendingFiles([]);
          if (onReplySent) onReplySent();
          if (textareaRef.current) textareaRef.current.style.height = 'auto';
          setShowSlashMenu(false);
        } else {
          toast.error(`Unbekannter Befehl: ${text.split(/\s/)[0]}`);
        }
      } catch {
        toast.error('Befehl fehlgeschlagen');
      }
      setSending(false);
      return;
    }

    setSending(true);
    try {
      let msg;
      if (readyAttachments.length > 0) {
        const attIds = readyAttachments.map((f) => f.attachmentId!);
        msg = await api.sendMessageWithAttachments(channelId, text || '', attIds, replyToId);
      } else {
        msg = await api.sendMessage(channelId, text, replyToId);
      }
      useAppStore.getState().addMessage(msg);
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
  }, [channelId, input, sending, pendingFiles, executeSlashCommand]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Slash command menu navigation
    if (showSlashMenu) {
      const filtered = getFilteredCommands();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSlashIndex((prev) => Math.min(prev + 1, filtered.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSlashIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && filtered.length > 0 && input.length <= slashFilter.length + 1)) {
        e.preventDefault();
        const cmd = filtered[selectedSlashIndex];
        if (cmd) {
          setInput(`/${cmd.name} `);
          setShowSlashMenu(false);
        }
        return;
      }
      if (e.key === 'Escape') {
        setShowSlashMenu(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getFilteredCommands = () => {
    if (!slashFilter) return SLASH_COMMANDS;
    return SLASH_COMMANDS.filter(c => c.name.startsWith(slashFilter));
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInput(val);
    if (val.length > 0) onTyping();

    // Show slash command menu when typing "/"
    if (val.startsWith('/') && !val.includes(' ')) {
      const filter = val.slice(1).toLowerCase();
      setSlashFilter(filter);
      setShowSlashMenu(true);
      setSelectedSlashIndex(0);
    } else {
      setShowSlashMenu(false);
    }

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
      {/* Slash command autocomplete */}
      {showSlashMenu && (
        <div className="slash-menu">
          {getFilteredCommands().map((cmd, i) => (
            <div
              key={cmd.name}
              className={`slash-menu-item ${i === selectedSlashIndex ? 'active' : ''}`}
              onClick={() => {
                if (cmd.name === 'poll') {
                  setShowPoll(true);
                  setInput('');
                  setShowSlashMenu(false);
                } else {
                  setInput(`/${cmd.name} `);
                  setShowSlashMenu(false);
                  textareaRef.current?.focus();
                }
              }}
              onMouseEnter={() => setSelectedSlashIndex(i)}
            >
              <div className="slash-menu-name">/{cmd.name}</div>
              <div className="slash-menu-desc">{cmd.description}</div>
            </div>
          ))}
          {getFilteredCommands().length === 0 && (
            <div className="slash-menu-item" style={{ opacity: 0.5 }}>
              <div className="slash-menu-desc">Kein passender Befehl</div>
            </div>
          )}
        </div>
      )}

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
            api.sendMessage(channelId, url, replyToId);
            if (onReplySent) onReplySent();
            setShowGif(false);
          }}
          onClose={() => setShowGif(false)}
        />
      )}

      {/* Poll dialog */}
      {showPoll && (
        <CreatePollDialog
          channelId={channelId}
          onClose={() => { setShowPoll(false); setInput(''); }}
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
        {/* Plus button for extras */}
        <button
          className="composer-action"
          onClick={() => setShowPoll(true)}
          title="Umfrage erstellen"
          aria-label="Umfrage erstellen"
          type="button"
          style={{ fontSize: 16, fontWeight: 700 }}
        >
          +
        </button>

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
                  toast.error('Datei zu groß (max. 25 MB)');
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
          placeholder={`Nachricht an #${channelName} — Tippe / für Befehle`}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          maxLength={4000}
          rows={1}
          autoFocus
        />

        {/* Send button */}
        <button
          className={`composer-send ${input.trim() || pendingFiles.some(f => f.attachmentId) ? 'active' : ''}`}
          onClick={handleSend}
          disabled={(!input.trim() && !pendingFiles.some(f => f.attachmentId)) || sending}
          title="Senden (Enter)"
          type="button"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
