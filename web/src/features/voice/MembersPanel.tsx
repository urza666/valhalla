/**
 * MembersPanel — LPP-identical right sidebar with guild members.
 * Shows online/offline with avatars, context menu, profile popout.
 */
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAuthStore } from '../../stores/auth';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { UserProfilePopout } from '../../components/ui/UserProfilePopout';
import { toast } from '../../stores/toast';
import type { Member } from '../../api/client';

interface Props {
  guildId: string;
}

export function MembersPanel({ guildId }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [popout, setPopout] = useState<{ userId: string; x: number; y: number } | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ member: Member; x: number; y: number } | null>(null);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    setLoading(true);
    api.getGuildMembers(guildId).then((m) => setMembers(m || [])).catch(() => {}).finally(() => setLoading(false));
  }, [guildId]);

  // Close context menu on click outside
  useEffect(() => {
    if (!ctxMenu) return;
    const h = () => setCtxMenu(null);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [ctxMenu]);

  return (
    <aside style={{
      width: 240, flexShrink: 0,
      background: 'var(--bg-primary, #0e1218)',
      borderLeft: '1px solid var(--color-voice-border, rgba(255,255,255,0.06))',
      overflowY: 'auto', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', fontSize: 12, fontWeight: 700,
        color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        Mitglieder — {members.length}
      </div>

      {loading ? (
        <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>Laden...</div>
      ) : (
        members.map((m) => {
          const u = m.user;
          if (!u) return null;
          const name = m.nick || u.display_name || u.username;
          const isMe = u.id === user?.id;

          return (
            <div
              key={m.user_id}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 16px', cursor: 'pointer',
                transition: 'background 0.1s',
              }}
              onClick={(e) => setPopout({ userId: u.id, x: e.clientX, y: e.clientY })}
              onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ member: m, x: e.clientX, y: e.clientY }); }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(200,168,74,0.04)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <UserAvatar
                user={{ username: u.username, display_name: u.display_name, avatar: u.avatar }}
                size={32} showStatus status="online"
              />
              <span style={{
                fontSize: 14, fontWeight: isMe ? 600 : 400,
                color: isMe ? 'var(--brand-primary, #c8a84a)' : 'var(--text-secondary, #9ba8b8)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {name}
              </span>
            </div>
          );
        })
      )}

      {/* Context menu */}
      {ctxMenu && (
        <MemberContextMenu
          member={ctxMenu.member}
          x={ctxMenu.x} y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          onProfile={(userId, x, y) => { setCtxMenu(null); setPopout({ userId, x, y }); }}
        />
      )}

      {/* Profile popout */}
      {popout && <UserProfilePopout userId={popout.userId} x={popout.x} y={popout.y} onClose={() => setPopout(null)} />}
    </aside>
  );
}

function MemberContextMenu({ member, x, y, onClose, onProfile }: {
  member: Member; x: number; y: number;
  onClose: () => void; onProfile: (userId: string, x: number, y: number) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const u = member.user!;
  const isSelf = u.id === user?.id;

  const items = [
    { label: 'Profil anzeigen', icon: '👤', onClick: () => onProfile(u.id, x, y) },
    { label: 'Nachricht senden', icon: '💬', onClick: () => openDM(u.id, u.display_name || u.username) },
    ...(!isSelf ? [
      { label: 'Freundschaftsanfrage', icon: '➕', onClick: () => sendFriend(u.username) },
      { label: 'Blockieren', icon: '🚫', danger: true, onClick: () => blockUser(u.id) },
    ] : []),
  ];

  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - items.length * 36 - 16);

  return (
    <div style={{
      position: 'fixed', left: adjustedX, top: adjustedY, zIndex: 9999,
      background: 'var(--color-voice-surface, #1e1f22)',
      border: '1px solid var(--color-voice-border)',
      borderRadius: 8, padding: '0.35rem', minWidth: 180,
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      animation: 'fadeIn 100ms ease-out',
    }}>
      {items.map((item, i) => (
        <button key={i} onClick={() => { item.onClick(); onClose(); }} style={{
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

async function openDM(userId: string, name: string) {
  try {
    const ch = await api.createDM(userId);
    window.dispatchEvent(new CustomEvent('valhalla:open-dm', { detail: { channelId: ch.id, recipientName: name } }));
    toast.success(`DM mit ${name} geoeffnet`);
  } catch { toast.error('DM fehlgeschlagen'); }
}

async function sendFriend(username: string) {
  try { await api.sendFriendRequest(username); toast.success('Anfrage gesendet'); } catch { toast.error('Fehler'); }
}

async function blockUser(userId: string) {
  try { await api.blockUser(userId); toast.success('Blockiert'); } catch { toast.error('Fehler'); }
}
