import { useState } from 'react';
import { api, Guild } from '../../api/client';

interface Props {
  guild: Guild;
  onClose: () => void;
  onUpdate: (guild: Guild) => void;
  onDelete: () => void;
}

export function ServerSettings({ guild, onClose, onUpdate, onDelete }: Props) {
  const [tab, setTab] = useState<'overview' | 'channels' | 'members' | 'roles'>('overview');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-sidebar">
          <div className="settings-sidebar-title">{guild.name}</div>
          <button className={`settings-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Ubersicht</button>
          <button className={`settings-tab ${tab === 'channels' ? 'active' : ''}`} onClick={() => setTab('channels')}>Kanale</button>
          <button className={`settings-tab ${tab === 'members' ? 'active' : ''}`} onClick={() => setTab('members')}>Mitglieder</button>
          <button className={`settings-tab ${tab === 'roles' ? 'active' : ''}`} onClick={() => setTab('roles')}>Rollen</button>
          <div className="settings-tab-sep" />
          <button className="settings-tab danger" onClick={onDelete}>Server loschen</button>
        </div>
        <div className="settings-content">
          <button className="settings-close" onClick={onClose}>ESC</button>
          {tab === 'overview' && <OverviewTab guild={guild} onUpdate={onUpdate} />}
          {tab === 'channels' && <ChannelsTab guildId={guild.id} />}
          {tab === 'members' && <MembersTab guildId={guild.id} />}
          {tab === 'roles' && <RolesTab guildId={guild.id} />}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ guild, onUpdate }: { guild: Guild; onUpdate: (g: Guild) => void }) {
  const [name, setName] = useState(guild.name);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const updated = await api.getGuild(guild.id); // PATCH would be: api.updateGuild
      onUpdate({ ...updated, name });
    } catch { /* ignore */ }
    setSaving(false);
  };

  return (
    <div>
      <h2>Server-Ubersicht</h2>
      <div className="form-group" style={{ marginTop: 20 }}>
        <label>Servername</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <button className="btn" style={{ width: 'auto', marginTop: 12 }} onClick={save} disabled={saving}>
        {saving ? 'Speichern...' : 'Speichern'}
      </button>
    </div>
  );
}

function ChannelsTab({ guildId }: { guildId: string }) {
  const [channels, setChannels] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState(0);

  if (!loaded) {
    api.getGuildChannels(guildId).then((c) => { setChannels(c || []); setLoaded(true); });
  }

  const createChannel = async () => {
    if (!newName.trim()) return;
    try {
      const ch = await api.createChannel(guildId, newName.trim(), newType);
      setChannels([...channels, ch]);
      setNewName('');
    } catch { /* ignore */ }
  };

  return (
    <div>
      <h2>Kanale</h2>
      <div style={{ display: 'flex', gap: 8, marginTop: 16, marginBottom: 16 }}>
        <input placeholder="Kanalname" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ flex: 1 }} />
        <select value={newType} onChange={(e) => setNewType(Number(e.target.value))} className="form-select">
          <option value={0}>Text</option>
          <option value={2}>Voice</option>
          <option value={4}>Kategorie</option>
        </select>
        <button className="btn" style={{ width: 'auto' }} onClick={createChannel}>Erstellen</button>
      </div>
      <div className="settings-list">
        {channels.map((ch) => (
          <div key={ch.id} className="settings-list-item">
            <span>{ch.type === 2 ? '🔊' : ch.type === 4 ? '📁' : '#'} {ch.name}</span>
            <button className="btn-small danger" onClick={() => {
              fetch(`/api/v1/channels/${ch.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
              setChannels(channels.filter((c) => c.id !== ch.id));
            }}>Loschen</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MembersTab({ guildId }: { guildId: string }) {
  const [members, setMembers] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  if (!loaded) {
    api.getGuildMembers(guildId).then((m) => { setMembers(m || []); setLoaded(true); });
  }

  const kick = async (userId: string) => {
    await fetch(`/api/v1/guilds/${guildId}/members/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    setMembers(members.filter((m) => m.user_id !== userId));
  };

  return (
    <div>
      <h2>Mitglieder ({members.length})</h2>
      <div className="settings-list" style={{ marginTop: 16 }}>
        {members.map((m) => (
          <div key={m.user_id} className="settings-list-item">
            <span>{m.user?.display_name || m.user?.username || m.user_id}</span>
            <button className="btn-small danger" onClick={() => kick(m.user_id)}>Kicken</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function RolesTab({ guildId }: { guildId: string }) {
  const [roles, setRoles] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  if (!loaded) {
    fetch(`/api/v1/guilds/${guildId}/roles`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then((r) => r.json())
      .then((r) => { setRoles(r || []); setLoaded(true); });
  }

  return (
    <div>
      <h2>Rollen</h2>
      <div className="settings-list" style={{ marginTop: 16 }}>
        {roles.map((r: any) => (
          <div key={r.id} className="settings-list-item">
            <span style={{ color: r.color ? `#${r.color.toString(16).padStart(6, '0')}` : 'inherit' }}>
              {r.name}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Position {r.position}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
