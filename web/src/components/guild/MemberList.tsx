import { useEffect, useState } from 'react';
import { api, Member } from '../../api/client';
import { useAuthStore } from '../../stores/auth';
import { useAppStore } from '../../stores/app';
import { PresenceBadge } from '../common/PresenceBadge';
import { ContextMenu, useContextMenu, MenuItem } from '../common/ContextMenu';
import { UserProfilePopout } from '../common/UserProfilePopout';
import { toast } from '../../stores/toast';

interface Props {
  guildId: string;
}

export function MemberList({ guildId }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getGuildMembers(guildId)
      .then((m) => setMembers(m || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [guildId]);

  if (loading) {
    return (
      <aside className="member-list" aria-label="Mitglieder">
        <div className="member-list-header">Mitglieder</div>
        <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 14 }}>Laden...</div>
      </aside>
    );
  }

  const online = members;
  const offline: Member[] = [];

  return (
    <aside className="member-list" aria-label="Mitglieder">
      {online.length > 0 && (
        <>
          <div className="member-list-header">Online — {online.length}</div>
          {online.map((m) => (
            <MemberItem key={m.user_id} member={m} guildId={guildId} status="online" />
          ))}
        </>
      )}
      {offline.length > 0 && (
        <>
          <div className="member-list-header">Offline — {offline.length}</div>
          {offline.map((m) => (
            <MemberItem key={m.user_id} member={m} guildId={guildId} status="offline" />
          ))}
        </>
      )}
    </aside>
  );
}

function MemberItem({ member, guildId, status }: { member: Member; guildId: string; status: 'online' | 'offline' }) {
  const user = member.user;
  const { user: currentUser } = useAuthStore();
  const { guilds } = useAppStore();
  const ctx = useContextMenu();
  const [popout, setPopout] = useState<{ x: number; y: number } | null>(null);

  if (!user) return null;

  const name = member.nick || user.display_name || user.username;
  const guild = guilds.find(g => g.id === guildId);
  const isOwner = guild?.owner_id === currentUser?.id;
  const isSelf = user.id === currentUser?.id;

  const getContextItems = (): MenuItem[] => {
    const items: MenuItem[] = [
      { label: 'Profil anzeigen', icon: '👤', onClick: () => {} },
      { label: 'Nachricht senden', icon: '💬', onClick: () => startDM(user.id) },
    ];

    if (!isSelf) {
      items.push({ separator: true });
      items.push({ label: 'Freundschaftsanfrage', icon: '➕', onClick: () => sendFriendRequest(user.username) });
      items.push({ label: 'Blockieren', icon: '🚫', danger: true, onClick: () => blockUser(user.id) });
    }

    if (isOwner && !isSelf) {
      items.push({ separator: true });
      items.push({ label: 'Kicken', icon: '👢', danger: true, onClick: () => kickMember(guildId, user.id, name) });
      items.push({ label: 'Bannen', icon: '🔨', danger: true, onClick: () => banMember(guildId, user.id, name) });
    }

    return items;
  };

  const handleClick = (e: React.MouseEvent) => {
    setPopout({ x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <div
        className="member-item"
        onClick={handleClick}
        onContextMenu={(e) => ctx.show(e, getContextItems())}
        style={{ cursor: 'pointer' }}
      >
        <div className="member-avatar-wrap">
          <div className="member-avatar" style={{ opacity: status === 'offline' ? 0.4 : 1 }}>
            {user.username[0].toUpperCase()}
          </div>
          <PresenceBadge status={status} size={8} />
        </div>
        <span className="member-name" style={{ opacity: status === 'offline' ? 0.4 : 1 }}>
          {name}
        </span>
      </div>

      {ctx.menu && (
        <ContextMenu x={ctx.menu.x} y={ctx.menu.y} items={ctx.menu.items} onClose={ctx.close} />
      )}

      {popout && (
        <UserProfilePopout
          userId={user.id}
          x={popout.x}
          y={popout.y}
          onClose={() => setPopout(null)}
        />
      )}
    </>
  );
}

async function startDM(userId: string) {
  try {
    const channel = await api.createDM(userId);
    // Navigate to DM - store the DM channel and select it
    const { selectChannel } = useAppStore.getState();
    selectChannel(channel.id);
    toast.success('DM-Kanal geöffnet');
  } catch {
    toast.error('DM konnte nicht erstellt werden');
  }
}

async function sendFriendRequest(username: string) {
  try {
    await api.sendFriendRequest(username);
    toast.success('Freundschaftsanfrage gesendet');
  } catch {
    toast.error('Anfrage konnte nicht gesendet werden');
  }
}

async function blockUser(userId: string) {
  if (!confirm('Benutzer wirklich blockieren?')) return;
  try {
    await api.blockUser(userId);
    toast.success('Benutzer blockiert');
  } catch {
    toast.error('Blockieren fehlgeschlagen');
  }
}

async function kickMember(guildId: string, userId: string, name: string) {
  if (!confirm(`${name} wirklich kicken?`)) return;
  try {
    await api.kickMember(guildId, userId);
    toast.success(`${name} wurde gekickt`);
  } catch {
    toast.error('Kicken fehlgeschlagen');
  }
}

async function banMember(guildId: string, userId: string, name: string) {
  const reason = prompt(`Grund für den Bann von ${name} (optional):`);
  if (reason === null) return; // cancelled
  try {
    await api.banUser(guildId, userId, reason || undefined);
    toast.success(`${name} wurde gebannt`);
  } catch {
    toast.error('Bannen fehlgeschlagen');
  }
}
