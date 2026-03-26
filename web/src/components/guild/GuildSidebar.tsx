import { useState } from 'react';
import { api } from '../../api/client';
import type { Guild } from '../../api/client';
import { useAppStore } from '../../stores/app';

interface Props {
  guilds: Guild[];
  selectedGuildId: string | null;
  onSelectGuild: (id: string) => void;
  onCreateGuild: () => void;
}

export function GuildSidebar({ guilds, selectedGuildId, onSelectGuild, onCreateGuild }: Props) {
  const [showJoin, setShowJoin] = useState(false);

  return (
    <div className="guild-sidebar">
      {/* DM button */}
      <div
        className={`guild-icon ${!selectedGuildId ? 'active' : ''}`}
        title="Direktnachrichten"
        style={{ marginBottom: 8, fontSize: 22 }}
      >
        💬
      </div>

      <div style={{ width: 32, height: 2, background: 'var(--border-subtle)', borderRadius: 1, marginBottom: 8 }} />

      {guilds.map((guild) => (
        <div
          key={guild.id}
          className={`guild-icon ${guild.id === selectedGuildId ? 'active' : ''}`}
          onClick={() => onSelectGuild(guild.id)}
          title={guild.name}
        >
          {guild.icon ? (
            <img src={`/api/v1/assets/icons/${guild.id}/${guild.icon}`} alt="" width={48} height={48} />
          ) : (
            getInitials(guild.name)
          )}
        </div>
      ))}

      {/* Add / Join buttons */}
      <div className="guild-icon add" onClick={onCreateGuild} title="Server erstellen">
        +
      </div>
      <div className="guild-icon add" onClick={() => setShowJoin(true)} title="Server beitreten" style={{ color: 'var(--status-online)', fontSize: 20 }}>
        ↓
      </div>

      {showJoin && <JoinServerDialog onClose={() => setShowJoin(false)} />}
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
    setLoading(true);
    setError('');
    try {
      await api.joinGuild(code.trim());
      await loadGuilds();
      onClose();
    } catch {
      setError('Ungueltige oder abgelaufene Einladung');
    }
    setLoading(false);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="auth-form" onClick={(e) => e.stopPropagation()} style={{ width: 440 }}>
        <h1 style={{ fontSize: 20 }}>Server beitreten</h1>
        <p>Gib einen Einladungscode ein</p>
        {error && <div className="error-text">{error}</div>}
        <div className="form-group">
          <label>Einladungscode</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="z.B. a1b2c3d4e5"
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            autoFocus
          />
        </div>
        <button className="btn" onClick={handleJoin} disabled={loading}>
          {loading ? 'Beitreten...' : 'Beitreten'}
        </button>
      </div>
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
