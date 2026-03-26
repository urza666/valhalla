import { useState } from 'react';
import { api, Guild } from '../../api/client';

interface Props {
  guild: Guild;
  onClose: () => void;
  onUpdate: (guild: Guild) => void;
  onDelete: () => void;
}

export function ServerSettings({ guild, onClose, onUpdate, onDelete }: Props) {
  const [tab, setTab] = useState<'overview' | 'channels' | 'members' | 'roles' | 'bans' | 'audit'>('overview');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-sidebar">
          <div className="settings-sidebar-title">{guild.name}</div>
          <button className={`settings-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Übersicht</button>
          <button className={`settings-tab ${tab === 'channels' ? 'active' : ''}`} onClick={() => setTab('channels')}>Kanäle</button>
          <button className={`settings-tab ${tab === 'members' ? 'active' : ''}`} onClick={() => setTab('members')}>Mitglieder</button>
          <button className={`settings-tab ${tab === 'roles' ? 'active' : ''}`} onClick={() => setTab('roles')}>Rollen</button>
          <button className={`settings-tab ${tab === 'bans' ? 'active' : ''}`} onClick={() => setTab('bans')}>Bans</button>
          <button className={`settings-tab ${tab === 'audit' ? 'active' : ''}`} onClick={() => setTab('audit')}>Audit Log</button>
          <div className="settings-tab-sep" />
          <button className="settings-tab danger" onClick={onDelete}>Server löschen</button>
        </div>
        <div className="settings-content">
          <button className="settings-close" onClick={onClose}>ESC</button>
          {tab === 'overview' && <OverviewTab guild={guild} onUpdate={onUpdate} />}
          {tab === 'channels' && <ChannelsTab guildId={guild.id} />}
          {tab === 'members' && <MembersTab guildId={guild.id} />}
          {tab === 'roles' && <RolesTab guildId={guild.id} />}
          {tab === 'bans' && <BansTab guildId={guild.id} />}
          {tab === 'audit' && <AuditLogTab guildId={guild.id} />}
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
      const res = await fetch(`/api/v1/guilds/${guild.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdate(updated);
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  return (
    <div>
      <h2>Serverübersicht</h2>
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
      <h2>Kanäle</h2>
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
            }}>Löschen</button>
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
  const [newRoleName, setNewRoleName] = useState('');
  const [editingRole, setEditingRole] = useState<any>(null);

  const headers = { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' };

  if (!loaded) {
    fetch(`/api/v1/guilds/${guildId}/roles`, { headers })
      .then((r) => r.json())
      .then((r) => { setRoles(r || []); setLoaded(true); });
  }

  const createRole = async () => {
    if (!newRoleName.trim()) return;
    const res = await fetch(`/api/v1/guilds/${guildId}/roles`, {
      method: 'POST', headers, body: JSON.stringify({ name: newRoleName.trim() }),
    });
    const role = await res.json();
    setRoles([...roles, role]);
    setNewRoleName('');
  };

  const deleteRole = async (roleId: string) => {
    if (!confirm('Rolle wirklich löschen?')) return;
    await fetch(`/api/v1/guilds/${guildId}/roles/${roleId}`, { method: 'DELETE', headers });
    setRoles(roles.filter((r) => r.id !== roleId));
  };

  const saveRole = async (role: any) => {
    await fetch(`/api/v1/guilds/${guildId}/roles/${role.id}`, {
      method: 'PATCH', headers, body: JSON.stringify(role),
    });
    setEditingRole(null);
    setLoaded(false);
  };

  // Permission names for the matrix
  const PERMS = [
    { name: 'Administrator', bit: 3 },
    { name: 'Server verwalten', bit: 5 },
    { name: 'Kanäle verwalten', bit: 4 },
    { name: 'Rollen verwalten', bit: 28 },
    { name: 'Mitglieder kicken', bit: 1 },
    { name: 'Mitglieder bannen', bit: 2 },
    { name: 'Timeout setzen', bit: 40 },
    { name: 'Nachrichten verwalten', bit: 13 },
    { name: 'Nachrichten senden', bit: 11 },
    { name: 'Dateien anhängen', bit: 15 },
    { name: 'Erwähnen @everyone', bit: 17 },
    { name: 'Kanal sehen', bit: 10 },
    { name: 'Verbinden (Voice)', bit: 20 },
    { name: 'Sprechen', bit: 21 },
    { name: 'Streamen', bit: 9 },
    { name: 'Stummschalten', bit: 22 },
  ];

  return (
    <div>
      <h2>Rollen</h2>

      {/* Create role */}
      <div style={{ display: 'flex', gap: 8, marginTop: 16, marginBottom: 16 }}>
        <input placeholder="Neuer Rollenname" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} style={{ flex: 1 }} />
        <button className="btn" style={{ width: 'auto' }} onClick={createRole}>Erstellen</button>
      </div>

      {/* Editing a role - permission matrix */}
      {editingRole && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, marginBottom: 12 }}>Rolle bearbeiten: {editingRole.name}</h3>
          <div className="form-group">
            <label>Name</label>
            <input value={editingRole.name} onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Farbe (Hex ohne #)</label>
            <input value={editingRole.color?.toString(16).padStart(6, '0') || '000000'}
              onChange={(e) => setEditingRole({ ...editingRole, color: parseInt(e.target.value, 16) || 0 })} />
          </div>
          <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>Berechtigungen</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {PERMS.map((p) => {
              const perms = BigInt(editingRole.permissions || '0');
              const hasPerm = (perms & (1n << BigInt(p.bit))) !== 0n;
              return (
                <label key={p.bit} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', fontSize: 14, cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <input type="checkbox" checked={hasPerm} onChange={() => {
                    const newPerms = hasPerm ? (perms & ~(1n << BigInt(p.bit))) : (perms | (1n << BigInt(p.bit)));
                    setEditingRole({ ...editingRole, permissions: newPerms.toString() });
                  }} />
                  {p.name}
                </label>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn" style={{ width: 'auto' }} onClick={() => saveRole(editingRole)}>Speichern</button>
            <button className="btn-small" onClick={() => setEditingRole(null)}>Abbrechen</button>
          </div>
        </div>
      )}

      {/* Role list */}
      <div className="settings-list">
        {roles.map((r: any) => (
          <div key={r.id} className="settings-list-item">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: r.color ? `#${r.color.toString(16).padStart(6, '0')}` : 'var(--text-muted)' }} />
              <span>{r.name}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Pos. {r.position}</span>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn-small" onClick={() => setEditingRole({ ...r, permissions: r.permissions?.toString() || '0' })}>Bearbeiten</button>
              {r.position > 0 && <button className="btn-small danger" onClick={() => deleteRole(r.id)}>Löschen</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BansTab({ guildId }: { guildId: string }) {
  const [bans, setBans] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

  if (!loaded) {
    fetch(`/api/v1/guilds/${guildId}/bans`, { headers })
      .then((r) => r.json())
      .then((b) => { setBans(b || []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }

  const unban = async (userId: string) => {
    await fetch(`/api/v1/guilds/${guildId}/bans/${userId}`, { method: 'DELETE', headers });
    setBans(bans.filter((b) => b.user_id !== userId));
  };

  return (
    <div>
      <h2>Bans ({bans.length})</h2>
      {bans.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', marginTop: 16 }}>Keine gebannten Nutzer.</p>
      ) : (
        <div className="settings-list" style={{ marginTop: 16 }}>
          {bans.map((b: any) => (
            <div key={b.user_id} className="settings-list-item">
              <div>
                <span>{b.user?.username || b.user_id}</span>
                {b.reason && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Grund: {b.reason}</div>}
              </div>
              <button className="btn-small" onClick={() => unban(b.user_id)}>Entbannen</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AuditLogTab({ guildId }: { guildId: string }) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  if (!loaded) {
    fetch(`/api/v1/guilds/${guildId}/audit-logs`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then((r) => r.json())
      .then((e) => { setEntries(e || []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }

  const actionNames: Record<number, string> = {
    1: 'Guild Update', 10: 'Channel Create', 11: 'Channel Update', 12: 'Channel Delete',
    20: 'Member Kick', 22: 'Member Ban Add', 23: 'Member Ban Remove',
    24: 'Member Update', 25: 'Member Role Update',
    30: 'Role Create', 31: 'Role Update', 32: 'Role Delete',
    72: 'Message Delete',
  };

  return (
    <div>
      <h2>Audit Log</h2>
      {entries.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', marginTop: 16 }}>Keine Einträge vorhanden.</p>
      ) : (
        <div className="settings-list" style={{ marginTop: 16 }}>
          {entries.map((e: any) => (
            <div key={e.id} className="settings-list-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontWeight: 600 }}>{actionNames[e.action_type] || `Action ${e.action_type}`}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.created_at?.split('T')[0]}</span>
              </div>
              {e.reason && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Grund: {e.reason}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
