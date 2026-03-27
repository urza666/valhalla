/**
 * ServerBar — LPP-identical left server icon strip.
 * DM home button, server icons with unread badges, create/join buttons.
 */
import { useState } from 'react';
import { useAppStore } from '../../stores/app';
import { useUnreadStore } from '../../stores/unread';
import { api } from '../../api/client';
import type { Guild } from '../../api/client';

interface Props {
  guilds: Guild[];
  selectedGuildId: string | null;
  onSelectGuild: (id: string) => void;
  onShowFriends: () => void;
  showFriends: boolean;
}

export function ServerBar({ guilds, selectedGuildId, onSelectGuild, onShowFriends, showFriends }: Props) {
  const [showJoin, setShowJoin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const { channels } = useAppStore();
  const unreadCounts = useUnreadStore((s) => s.unreadCounts);

  const getGuildUnread = (guildId: string): number => {
    const guildChannels = channels.get(guildId) || [];
    let total = 0;
    for (const ch of guildChannels) total += unreadCounts.get(ch.id) || 0;
    return total;
  };

  return (
    <nav style={{
      width: 56, flexShrink: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', padding: '8px 0', gap: 4,
      background: 'var(--bg-secondary, #080b0f)',
      overflowY: 'auto', overflowX: 'hidden',
    }}>
      {/* DM / Friends */}
      <ServerIcon
        active={showFriends}
        onClick={onShowFriends}
        title="Freunde & DMs"
        label="💬"
      />

      {/* Separator */}
      <div style={{ width: 32, height: 2, background: 'var(--border-subtle, rgba(200,168,74,0.12))', borderRadius: 1, margin: '4px 0' }} />

      {/* Server icons */}
      {guilds.map((guild) => {
        const unread = getGuildUnread(guild.id);
        return (
          <ServerIcon
            key={guild.id}
            active={guild.id === selectedGuildId}
            onClick={() => onSelectGuild(guild.id)}
            title={guild.name}
            label={guild.name ? getInitials(guild.name) : '?'}
            iconUrl={guild.icon ? `/api/v1/assets/icons/${guild.id}/${guild.icon}` : undefined}
            badge={unread > 0 ? (unread > 99 ? '99+' : String(unread)) : undefined}
          />
        );
      })}

      {/* Add server */}
      <ServerIcon
        onClick={() => setShowCreate(true)}
        title="Server erstellen"
        label="+"
        style={{ color: 'var(--status-online, #4caf84)', fontSize: 20 }}
      />

      {/* Join server */}
      <ServerIcon
        onClick={() => setShowJoin(true)}
        title="Server beitreten"
        label="↓"
        style={{ color: 'var(--status-online, #4caf84)', fontSize: 18 }}
      />

      {/* Create server dialog */}
      {showCreate && <CreateServerDialog onClose={() => setShowCreate(false)} />}
      {showJoin && <JoinServerDialog onClose={() => setShowJoin(false)} />}
    </nav>
  );
}

function ServerIcon({ active, onClick, title, label, iconUrl, badge, style: extraStyle }: {
  active?: boolean; onClick: () => void; title: string; label: string;
  iconUrl?: string; badge?: string; style?: React.CSSProperties;
}) {
  return (
    <div
      onClick={onClick}
      title={title}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      style={{
        width: 48, height: 48, borderRadius: active ? 16 : 24,
        background: active ? 'var(--brand-primary, #c8a84a)' : 'var(--bg-tertiary, #141920)',
        color: active ? '#080b0f' : 'var(--text-primary, #dde4ef)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, fontWeight: 700, cursor: 'pointer',
        transition: 'border-radius 0.2s ease, background 0.15s ease',
        overflow: 'hidden', position: 'relative', flexShrink: 0,
        ...extraStyle,
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.borderRadius = '16px';
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.borderRadius = '24px';
      }}
    >
      {iconUrl ? (
        <img src={iconUrl} alt="" width={48} height={48} style={{ objectFit: 'cover' }} />
      ) : label}
      {badge && (
        <span style={{
          position: 'absolute', bottom: -2, right: -2,
          background: 'var(--danger, #e85454)', color: '#fff',
          fontSize: 10, fontWeight: 700, borderRadius: 8,
          padding: '1px 5px', minWidth: 16, textAlign: 'center',
          border: '2px solid var(--bg-secondary, #080b0f)',
        }}>
          {badge}
        </span>
      )}
    </div>
  );
}

function CreateServerDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { createGuild } = useAppStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await createGuild(name.trim());
      onClose();
    } finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <form className="auth-form" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit} style={{ animation: 'slideUp 0.3s ease' }}>
        <h1>Server erstellen</h1>
        <p>Gib deinem Server einen Namen</p>
        <div className="form-group">
          <label>Servername</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100} autoFocus />
        </div>
        <button type="submit" className="btn-primary" style={{ width: '100%', padding: '10px 16px' }} disabled={loading}>
          {loading ? 'Erstellen...' : 'Erstellen'}
        </button>
      </form>
    </div>
  );
}

function JoinServerDialog({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loadGuilds } = useAppStore();

  const handleJoin = async () => {
    if (!code.trim()) return;
    setLoading(true); setError('');
    const trimmed = code.trim();
    const codeMatch = trimmed.match(/(?:invite|join)\/([A-Za-z0-9_-]+)/);
    const finalCode = codeMatch ? codeMatch[1] : trimmed;
    try {
      await api.joinGuild(finalCode);
      await loadGuilds();
      onClose();
    } catch { setError('Ungueltige oder abgelaufene Einladung'); }
    setLoading(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="auth-form" onClick={(e) => e.stopPropagation()} style={{ width: 440, animation: 'slideUp 0.3s ease' }}>
        <h1 style={{ fontSize: 20 }}>Server beitreten</h1>
        <p>Gib einen Einladungscode oder Link ein</p>
        {error && <div className="error-text">{error}</div>}
        <div className="form-group">
          <label>Einladungscode oder Link</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="z.B. a1b2c3d4 oder https://..." onKeyDown={(e) => e.key === 'Enter' && handleJoin()} autoFocus />
        </div>
        <button className="btn-primary" style={{ width: '100%', padding: '10px 16px' }} onClick={handleJoin} disabled={loading}>
          {loading ? 'Beitreten...' : 'Beitreten'}
        </button>
      </div>
    </div>
  );
}

function getInitials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}
