import { useEffect, useState } from 'react';
import { api, Member } from '../../api/client';
import { PresenceBadge } from '../common/PresenceBadge';

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
      <div className="member-list">
        <div className="member-list-header">Members</div>
        <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  // Split into online/offline (for now all are "online" since we don't have real presence yet)
  const online = members;
  const offline: Member[] = [];

  return (
    <div className="member-list">
      {online.length > 0 && (
        <>
          <div className="member-list-header">Online — {online.length}</div>
          {online.map((m) => (
            <MemberItem key={m.user_id} member={m} status="online" />
          ))}
        </>
      )}
      {offline.length > 0 && (
        <>
          <div className="member-list-header">Offline — {offline.length}</div>
          {offline.map((m) => (
            <MemberItem key={m.user_id} member={m} status="offline" />
          ))}
        </>
      )}
    </div>
  );
}

function MemberItem({ member, status }: { member: Member; status: 'online' | 'offline' }) {
  const user = member.user;
  if (!user) return null;

  const name = member.nick || user.display_name || user.username;

  return (
    <div className="member-item">
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
  );
}
