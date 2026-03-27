/**
 * ChatArea — LPP-identical message list with hover actions, reactions, reply, edit.
 * Uses Valhalla stores (WebSocket events) + api/client.ts (fetch).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Message as MessageType } from '../../api/client';

const EMPTY_MESSAGES: MessageType[] = [];
import { useAppStore } from '../../stores/app';
import { useAuthStore } from '../../stores/auth';
import { api } from '../../api/client';
import { toast } from '../../stores/toast';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { UserProfilePopout } from '../../components/ui/UserProfilePopout';
import { Markdown } from '../../components/chat/Markdown';
import { MessageComposer } from './MessageComposer';
import { KanbanBoard } from '../../components/kanban/KanbanBoard';
import { WikiView } from '../../components/wiki/WikiView';
import { VoiceVideoGrid } from './VoiceVideoGrid';
import { EMOJI_LIST } from './types';
import type { Message } from '../../api/client';

interface Props {
  channelId: string;
  channelName: string;
  guildId: string | null;
  viewMode: string;
  onSetViewMode: (v: string) => void;
}

export function ChatArea({ channelId, channelName, guildId, viewMode, onSetViewMode }: Props) {
  const messages = useAppStore((s) => s.messages.get(channelId) ?? EMPTY_MESSAGES);
  const user = useAuthStore((s) => s.user);
  const endRef = useRef<HTMLDivElement>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [popout, setPopout] = useState<{ userId: string; x: number; y: number } | null>(null);
  const [hoverMsgId, setHoverMsgId] = useState<string | null>(null);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState<string | null>(null);
  const [msgCtxMenu, setMsgCtxMenu] = useState<{ msg: Message; x: number; y: number } | null>(null);

  useEffect(() => { useAppStore.getState().loadMessages(channelId); }, [channelId]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);
  useEffect(() => { setReplyTo(null); setEditingId(null); }, [channelId]);

  // Typing debounce
  const lastTyping = useRef(0);
  const sendTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTyping.current > 10000) {
      lastTyping.current = now;
      api.sendTyping(channelId).catch(() => {});
    }
  }, [channelId]);

  // Drag & drop
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.size > 25 * 1024 * 1024) { toast.error(`${file.name}: Max 25 MB`); continue; }
      try {
        const att = await api.uploadAttachment(channelId, file);
        await api.sendMessageWithAttachments(channelId, '', [att.id]);
        toast.success(`${file.name} gesendet`);
      } catch { toast.error(`${file.name}: Upload fehlgeschlagen`); }
    }
  };

  const saveEdit = async (msgId: string) => {
    if (!editText.trim()) return;
    try {
      await api.editMessage(channelId, msgId, editText.trim());
      setEditingId(null); setEditText('');
    } catch { toast.error('Bearbeitung fehlgeschlagen'); }
  };

  const deleteMsg = async (msgId: string) => {
    if (!confirm('Nachricht loeschen?')) return;
    try {
      await api.deleteMessage(channelId, msgId);
      useAppStore.getState().removeMessage(channelId, msgId);
    } catch { toast.error('Loeschen fehlgeschlagen'); }
  };

  const pinMsg = (msgId: string) => {
    api.pinMessage(channelId, msgId).then(() => toast.success('Gepinnt')).catch(() => toast.error('Fehler'));
  };

  const addReaction = (msgId: string, emoji: string) => {
    api.addReaction(channelId, msgId, emoji).catch(() => {});
    setReactionPickerMsgId(null);
  };

  const removeReaction = (msgId: string, emoji: string) => {
    api.removeReaction(channelId, msgId, emoji).catch(() => {});
  };

  const shouldShowHeader = (idx: number): boolean => {
    if (idx === 0) return true;
    const prev = messages[idx - 1];
    const curr = messages[idx];
    if (prev.author.id !== curr.author.id) return true;
    return new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime() > 7 * 60 * 1000;
  };

  // Board/Wiki view modes
  if (viewMode === 'board' && guildId) return <KanbanBoard channelId={channelId} guildId={guildId} />;
  if (viewMode === 'wiki' && guildId) return <WikiView guildId={guildId} />;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div style={{
        padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8,
        borderBottom: '1px solid var(--color-voice-border, rgba(255,255,255,0.06))',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 18, color: 'var(--text-muted)', fontWeight: 300 }}>#</span>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{channelName}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {(['chat', 'board', 'wiki'] as const).map((v) => (
            <button key={v} onClick={() => onSetViewMode(v)} style={{
              padding: '4px 10px', borderRadius: 4, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
              background: viewMode === v ? 'rgba(200,168,74,0.15)' : 'transparent',
              color: viewMode === v ? 'var(--brand-primary, #c8a84a)' : 'var(--text-muted)',
              transition: 'background 0.1s',
            }}>
              {v === 'chat' ? 'Chat' : v === 'board' ? '📋' : '📖'}
            </button>
          ))}
        </div>
      </div>

      {/* Drag overlay */}
      {dragOver && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          background: 'rgba(88,101,242,0.1)', border: '2px dashed #5865f2',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 8, borderRadius: 8,
        }}>
          <div style={{ fontSize: 48 }}>📎</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#5865f2' }}>Dateien hier ablegen</div>
        </div>
      )}

      {/* Voice video grid (when connected) */}
      <VoiceVideoGrid />

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0.8rem', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>💬</div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Willkommen in #{channelName}</h2>
            <p style={{ fontSize: 14 }}>Schreibe die erste Nachricht!</p>
          </div>
        ) : messages.map((msg, idx) => {
          const showHeader = shouldShowHeader(idx);
          const isMe = msg.author.id === user?.id;
          const isHovered = hoverMsgId === msg.id;

          return (
            <div
              key={msg.id}
              style={{
                display: 'flex', gap: '0.5rem',
                paddingTop: showHeader ? '0.4rem' : 0,
                padding: '0.15rem 0.4rem',
                borderRadius: 4,
                background: isHovered ? 'rgba(79,84,92,0.16)' : 'transparent',
                position: 'relative',
                transition: 'background 0.1s',
              }}
              onMouseEnter={() => setHoverMsgId(msg.id)}
              onMouseLeave={() => { setHoverMsgId(null); if (reactionPickerMsgId === msg.id) setReactionPickerMsgId(null); }}
              onContextMenu={(e) => { e.preventDefault(); setMsgCtxMenu({ msg, x: e.clientX, y: e.clientY }); }}
            >
              {/* Avatar column */}
              <div style={{ width: 36, flexShrink: 0 }}>
                {showHeader && (
                  <UserAvatar
                    user={{ username: msg.author.username, display_name: msg.author.display_name, avatar: msg.author.avatar }}
                    size={36}
                    onClick={(e) => setPopout({ userId: msg.author.id, x: e.clientX, y: e.clientY })}
                  />
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {showHeader && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginBottom: '0.1rem' }}>
                    <span
                      style={{ fontSize: '0.8rem', fontWeight: 600, color: isMe ? '#7289da' : '#fff', cursor: 'pointer' }}
                      onClick={(e) => setPopout({ userId: msg.author.id, x: e.clientX, y: e.clientY })}
                    >
                      {msg.author.display_name || msg.author.username}
                    </span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted, #4a5568)' }}>
                      {new Date(msg.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.edited_timestamp && <span style={{ fontSize: '0.55rem', color: 'var(--text-muted)' }}>(bearbeitet)</span>}
                  </div>
                )}

                {/* Reply reference */}
                {msg.message_reference && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    fontSize: '0.65rem', color: 'var(--text-muted)',
                    marginBottom: '0.1rem', paddingLeft: '0.2rem',
                    borderLeft: '2px solid #5865f2',
                  }}>
                    <span style={{ fontWeight: 600, color: '#7289da' }}>↩ Antwort</span>
                  </div>
                )}

                {/* Edit mode */}
                {editingId === msg.id ? (
                  <div>
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(msg.id); }
                        if (e.key === 'Escape') { setEditingId(null); setEditText(''); }
                      }}
                      style={{
                        width: '100%', resize: 'none',
                        background: 'rgba(0,0,0,0.2)', border: '1px solid #5865f2',
                        borderRadius: 6, padding: '0.3rem 0.5rem',
                        color: 'var(--text-secondary, #9ba8b8)', fontSize: '0.82rem',
                        lineHeight: 1.4, outline: 'none', minHeight: 40,
                        fontFamily: 'inherit',
                      }}
                    />
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      Escape = Abbrechen · Enter = Speichern
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #9ba8b8)', lineHeight: 1.4, wordBreak: 'break-word' }}>
                    <Markdown content={msg.content} />
                  </div>
                )}

                {/* Attachments */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                    {msg.attachments.map((att) => {
                      const isImage = att.content_type?.startsWith('image/');
                      if (isImage) {
                        return (
                          <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer">
                            <img src={att.url} alt={att.filename} style={{ maxWidth: 350, maxHeight: 300, borderRadius: 8, display: 'block' }} loading="lazy" />
                          </a>
                        );
                      }
                      return (
                        <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer"
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            padding: '8px 12px', background: 'var(--color-voice-surface, #1e1f22)',
                            borderRadius: 6, color: 'var(--color-voice-link, #00aff4)', textDecoration: 'none', fontSize: 13, maxWidth: 350,
                          }}>
                          <span>📄</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.filename}</span>
                        </a>
                      );
                    })}
                  </div>
                )}

                {/* Reactions */}
                {msg.reactions && msg.reactions.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                    {msg.reactions.map((r) => (
                      <button key={r.emoji} onClick={() => r.me ? removeReaction(msg.id, r.emoji) : addReaction(msg.id, r.emoji)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '2px 6px', borderRadius: 4, fontSize: 13, cursor: 'pointer',
                          border: r.me ? '1px solid #5865f2' : '1px solid rgba(255,255,255,0.06)',
                          background: r.me ? 'rgba(88,101,242,0.15)' : 'rgba(255,255,255,0.02)',
                          color: 'var(--text-primary)',
                        }}>
                        {r.emoji} <span style={{ fontSize: 11, fontWeight: 600 }}>{r.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Hover action bar (LPP-identical) */}
              {isHovered && !editingId && (
                <div style={{
                  position: 'absolute', top: -8, right: 8,
                  display: 'flex', gap: 2,
                  background: 'var(--color-voice-surface, #1e1f22)',
                  border: '1px solid var(--color-voice-border, rgba(255,255,255,0.08))',
                  borderRadius: 4, padding: 2,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}>
                  <ActionBtn onClick={() => setReplyTo(msg)} title="Antworten">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 00-4-4H4"/></svg>
                  </ActionBtn>
                  <ActionBtn onClick={() => setReactionPickerMsgId(reactionPickerMsgId === msg.id ? null : msg.id)} title="Reaktion">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
                  </ActionBtn>
                  <ActionBtn onClick={() => pinMsg(msg.id)} title="Pinnen">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 17v5m-7-5h14l-2-8H7l-2 8z"/><circle cx="12" cy="6" r="3"/></svg>
                  </ActionBtn>
                  {isMe && (
                    <ActionBtn onClick={() => { setEditingId(msg.id); setEditText(msg.content); }} title="Bearbeiten">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </ActionBtn>
                  )}
                  {isMe && (
                    <ActionBtn onClick={() => deleteMsg(msg.id)} title="Loeschen" danger>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                    </ActionBtn>
                  )}
                </div>
              )}

              {/* Quick reaction picker */}
              {reactionPickerMsgId === msg.id && (
                <div style={{
                  position: 'absolute', top: -40, right: 8, zIndex: 20,
                  display: 'flex', gap: 2, padding: 4,
                  background: 'var(--color-voice-surface, #1e1f22)',
                  border: '1px solid var(--color-voice-border)',
                  borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                }}>
                  {EMOJI_LIST.slice(0, 8).map((e) => (
                    <button key={e} onClick={() => addReaction(msg.id, e)}
                      style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', padding: 2, borderRadius: 4 }}
                      onMouseEnter={(ev) => { (ev.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
                      onMouseLeave={(ev) => { (ev.currentTarget as HTMLElement).style.background = 'none'; }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Reply banner */}
      {replyTo && (
        <div style={{
          padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(88,101,242,0.1)',
          borderTop: '2px solid #5865f2', fontSize: 13,
        }}>
          <span>Antwort an <strong>{replyTo.author.display_name || replyTo.author.username}</strong></span>
          <span style={{ flex: 1, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {replyTo.content.slice(0, 80)}
          </span>
          <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* Composer */}
      <MessageComposer
        channelId={channelId}
        channelName={channelName}
        onTyping={sendTyping}
        replyToId={replyTo?.id}
        onReplySent={() => setReplyTo(null)}
      />

      {/* Message context menu (right-click) */}
      {msgCtxMenu && (
        <MessageContextMenu
          msg={msgCtxMenu.msg} x={msgCtxMenu.x} y={msgCtxMenu.y}
          channelId={channelId}
          isAuthor={msgCtxMenu.msg.author.id === user?.id}
          onReply={() => { setReplyTo(msgCtxMenu.msg); setMsgCtxMenu(null); }}
          onEdit={() => { setEditingId(msgCtxMenu.msg.id); setEditText(msgCtxMenu.msg.content); setMsgCtxMenu(null); }}
          onClose={() => setMsgCtxMenu(null)}
        />
      )}

      {/* Profile popout */}
      {popout && (
        <UserProfilePopout userId={popout.userId} x={popout.x} y={popout.y} onClose={() => setPopout(null)} />
      )}
    </div>
  );
}

function ActionBtn({ onClick, title, danger, children }: {
  onClick: () => void; title: string; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} title={title} style={{
      background: 'none', border: 'none', padding: 4, borderRadius: 4,
      cursor: 'pointer', color: danger ? '#ed4245' : 'var(--color-voice-text-muted, #96989d)',
      display: 'flex', alignItems: 'center',
    }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = danger ? 'rgba(237,66,69,0.15)' : 'rgba(255,255,255,0.08)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
    >
      {children}
    </button>
  );
}

/** Message Context Menu — LPP-identical right-click menu */
function MessageContextMenu({ msg, x, y, channelId, isAuthor, onReply, onEdit, onClose }: {
  msg: Message; x: number; y: number; channelId: string; isAuthor: boolean;
  onReply: () => void; onEdit: () => void; onClose: () => void;
}) {
  useEffect(() => {
    const h = () => onClose();
    document.addEventListener('click', h);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('click', h); document.removeEventListener('keydown', esc); };
  }, [onClose]);

  const items = [
    { label: 'Antworten', icon: '↩️', onClick: onReply },
    { label: 'Reaktion', icon: '😀', onClick: () => { /* handled via hover bar */ onClose(); } },
    { label: 'Pinnen', icon: '📌', onClick: () => { api.pinMessage(channelId, msg.id).then(() => toast.success('Gepinnt')).catch(() => toast.error('Fehler')); onClose(); } },
    { label: 'Link kopieren', icon: '🔗', onClick: () => { navigator.clipboard.writeText(`${window.location.origin}/channels/${channelId}/${msg.id}`); toast.success('Link kopiert'); onClose(); } },
    ...(isAuthor ? [
      { label: 'Bearbeiten', icon: '✏️', onClick: onEdit },
      { label: 'Loeschen', icon: '🗑️', danger: true, onClick: () => {
        if (confirm('Nachricht loeschen?')) {
          api.deleteMessage(channelId, msg.id).then(() => useAppStore.getState().removeMessage(channelId, msg.id)).catch(() => toast.error('Fehler'));
        }
        onClose();
      }},
    ] : []),
    { label: 'Melden', icon: '🚩', danger: true, onClick: () => { toast.info('Nachricht gemeldet'); onClose(); } },
  ];

  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - items.length * 36 - 16);

  return (
    <div style={{
      position: 'fixed', left: adjustedX, top: adjustedY, zIndex: 9999,
      background: 'var(--color-voice-surface, #1e1f22)',
      border: '1px solid var(--color-voice-border)',
      borderRadius: 8, padding: '0.35rem', minWidth: 200,
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      animation: 'fadeIn 100ms ease-out',
    }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item, i) => (
        <button key={i} onClick={item.onClick} style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '6px 10px', borderRadius: 4, border: 'none', cursor: 'pointer',
          background: 'transparent',
          color: (item as any).danger ? '#ed4245' : 'var(--color-voice-text, #dcddde)',
          fontSize: 13, textAlign: 'left', fontWeight: 500,
        }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = (item as any).danger ? 'rgba(237,66,69,0.1)' : 'rgba(88,101,242,0.15)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <span style={{ width: 20, textAlign: 'center' }}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
}
