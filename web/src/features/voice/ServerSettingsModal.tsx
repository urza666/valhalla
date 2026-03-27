/**
 * ServerSettingsModal — LPP-identical server settings with tabs.
 * Tabs: Overview, Roles, Bans, Audit Log.
 */
import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useAppStore } from '../../stores/app';
import { toast } from '../../stores/toast';
import { Modal } from '../../components/ui/Modal';
import type { Guild, Role, Ban, AuditLogEntry } from '../../api/client';

interface Props {
  guild: Guild;
  isOpen: boolean;
  onClose: () => void;
}

export function ServerSettingsModal({ guild, isOpen, onClose }: Props) {
  const [tab, setTab] = useState<'overview' | 'roles' | 'bans' | 'audit'>('overview');
  const [name, setName] = useState(guild.name);
  const [saving, setSaving] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [bans, setBans] = useState<Ban[]>([]);
  const [audit, setAudit] = useState<AuditLogEntry[]>([]);
  const [newRoleName, setNewRoleName] = useState('');

  useEffect(() => { setName(guild.name); }, [guild.name]);

  useEffect(() => {
    if (!isOpen) return;
    if (tab === 'roles') api.getGuildRoles(guild.id).then(setRoles).catch(() => {});
    if (tab === 'bans') api.getGuildBans(guild.id).then(setBans).catch(() => {});
    if (tab === 'audit') api.getAuditLog(guild.id).then(setAudit).catch(() => {});
  }, [isOpen, tab, guild.id]);

  const saveOverview = async () => {
    if (!name.trim() || name === guild.name) return;
    setSaving(true);
    try {
      await api.updateGuild(guild.id, { name: name.trim() });
      useAppStore.getState().loadGuilds();
      toast.success('Server aktualisiert');
    } catch { toast.error('Speichern fehlgeschlagen'); }
    setSaving(false);
  };

  const deleteServer = async () => {
    if (!confirm(`Server "${guild.name}" ENDGUELTIG loeschen? Das kann nicht rueckgaengig gemacht werden!`)) return;
    try {
      await api.deleteGuild(guild.id);
      useAppStore.getState().loadGuilds();
      onClose();
      toast.success('Server geloescht');
    } catch { toast.error('Loeschen fehlgeschlagen'); }
  };

  const createRole = async () => {
    if (!newRoleName.trim()) return;
    try {
      await api.createRole(guild.id, newRoleName.trim());
      setNewRoleName('');
      api.getGuildRoles(guild.id).then(setRoles);
      toast.success('Rolle erstellt');
    } catch { toast.error('Fehler'); }
  };

  const deleteRole = async (roleId: string) => {
    try {
      await api.deleteRole(guild.id, roleId);
      setRoles(roles.filter((r) => r.id !== roleId));
      toast.success('Rolle geloescht');
    } catch { toast.error('Fehler'); }
  };

  const unban = async (userId: string) => {
    try {
      await api.unbanUser(guild.id, userId);
      setBans(bans.filter((b) => b.user_id !== userId));
      toast.success('Entbannt');
    } catch { toast.error('Fehler'); }
  };

  const tabs = [
    { key: 'overview', label: 'Uebersicht', icon: '⚙️' },
    { key: 'roles', label: 'Rollen', icon: '🛡️' },
    { key: 'bans', label: 'Bans', icon: '🔨' },
    { key: 'audit', label: 'Audit Log', icon: '📋' },
  ] as const;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${guild.name} — Einstellungen`} size="lg">
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--color-border, #1e2733)', paddingBottom: 8 }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '6px 14px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: tab === t.key ? 'rgba(200,168,74,0.15)' : 'transparent',
            color: tab === t.key ? 'var(--brand-primary, #c8a84a)' : 'var(--text-muted)',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Servername</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-secondary, #080b0f)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 14, outline: 'none' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={saveOverview} disabled={saving || !name.trim() || name === guild.name}
              style={{ padding: '8px 20px', borderRadius: 4, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #c8a84a, #8a6e28)', color: '#080b0f', fontWeight: 700, fontSize: 14, opacity: (!name.trim() || name === guild.name) ? 0.5 : 1 }}>
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(237,66,69,0.2)' }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: '#ed4245', marginBottom: 8 }}>Gefahrenzone</h4>
            <button onClick={deleteServer} style={{
              padding: '8px 20px', borderRadius: 4, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #ed4245, #dc2626)', color: '#fff', fontWeight: 700, fontSize: 14,
            }}>
              Server loeschen
            </button>
          </div>
        </div>
      )}

      {/* Roles */}
      {tab === 'roles' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="Neuer Rollenname"
              onKeyDown={(e) => e.key === 'Enter' && createRole()}
              style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 14, outline: 'none' }} />
            <button onClick={createRole} style={{ padding: '8px 16px', borderRadius: 4, border: 'none', cursor: 'pointer', background: 'rgba(200,168,74,0.15)', color: 'var(--brand-primary)', fontWeight: 600, fontSize: 13 }}>
              + Erstellen
            </button>
          </div>
          {roles.map((role) => (
            <div key={role.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: role.color ? `#${role.color.toString(16).padStart(6, '0')}` : 'var(--text-muted)' }} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{role.name}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pos: {role.position}</span>
              <button onClick={() => deleteRole(role.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ed4245', fontSize: 12 }}>Loeschen</button>
            </div>
          ))}
          {roles.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Keine Rollen vorhanden</div>}
        </div>
      )}

      {/* Bans */}
      {tab === 'bans' && (
        <div>
          {bans.map((ban) => (
            <div key={ban.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ flex: 1, fontSize: 14 }}>{ban.user?.username || ban.user_id}</span>
              {ban.reason && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ban.reason}</span>}
              <button onClick={() => unban(ban.user_id)} style={{ padding: '4px 12px', borderRadius: 4, border: 'none', cursor: 'pointer', background: 'rgba(59,165,93,0.15)', color: '#3ba55d', fontSize: 12, fontWeight: 600 }}>
                Entbannen
              </button>
            </div>
          ))}
          {bans.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Keine Bans vorhanden</div>}
        </div>
      )}

      {/* Audit Log */}
      {tab === 'audit' && (
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {audit.map((entry) => (
            <div key={entry.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--color-border)', fontSize: 13 }}>
              <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>
                {actionLabels[entry.action_type] || `Action ${entry.action_type}`}
              </span>
              <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 11 }}>
                {new Date(entry.created_at).toLocaleString('de-DE')}
              </span>
              {entry.reason && <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>— {entry.reason}</span>}
            </div>
          ))}
          {audit.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Keine Audit-Eintraege</div>}
        </div>
      )}
    </Modal>
  );
}

const actionLabels: Record<number, string> = {
  1: 'Guild erstellt', 2: 'Guild aktualisiert', 10: 'Kanal erstellt', 11: 'Kanal aktualisiert', 12: 'Kanal geloescht',
  20: 'Mitglied gekickt', 22: 'Mitglied gebannt', 23: 'Mitglied entbannt', 30: 'Rolle erstellt', 31: 'Rolle aktualisiert', 32: 'Rolle geloescht',
  72: 'Nachricht geloescht', 80: 'Einladung erstellt',
};
