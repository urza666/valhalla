/**
 * FriendsPanel — LPP-identical friends management with tabs.
 * Tabs: All, Online, Pending, Add Friend.
 */
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { toast } from '../../stores/toast';
import { UserAvatar } from '../../components/ui/UserAvatar';
import type { Relationship } from '../../api/client';

export function FriendsPanel() {
  const [rels, setRels] = useState<Relationship[]>([]);
  const [tab, setTab] = useState<'all' | 'pending' | 'add'>('all');
  const [addUsername, setAddUsername] = useState('');
  const [addMsg, setAddMsg] = useState('');
  const [addSuccess, setAddSuccess] = useState(false);

  useEffect(() => {
    api.getRelationships().then(setRels).catch(() => {});
  }, []);

  const friends = rels.filter((r) => r.type === 1);
  const pending = rels.filter((r) => r.type === 3 || r.type === 4);

  const sendRequest = async () => {
    if (!addUsername.trim()) return;
    setAddMsg(''); setAddSuccess(false);
    try {
      await api.sendFriendRequest(addUsername.trim());
      setAddMsg('Freundschaftsanfrage gesendet!');
      setAddSuccess(true); setAddUsername('');
    } catch (err: unknown) {
      setAddMsg(err instanceof Error ? err.message : 'Fehler');
      setAddSuccess(false);
    }
  };

  const accept = async (targetId: string) => {
    try { await api.acceptFriendRequest(targetId); setRels(rels.map((r) => r.id === targetId ? { ...r, type: 1 } : r)); } catch { /* */ }
  };
  const remove = async (targetId: string) => {
    try { await api.removeRelationship(targetId); setRels(rels.filter((r) => r.id !== targetId)); } catch { /* */ }
  };

  const openDM = async (userId: string, name: string) => {
    try {
      const ch = await api.createDM(userId);
      window.dispatchEvent(new CustomEvent('valhalla:open-dm', { detail: { channelId: ch.id, recipientName: name } }));
    } catch { toast.error('DM konnte nicht erstellt werden'); }
  };

  const tabs = [
    { key: 'all', label: `Alle (${friends.length})` },
    { key: 'pending', label: `Ausstehend${pending.length ? ` (${pending.length})` : ''}` },
    { key: 'add', label: 'Hinzufuegen', green: true },
  ] as const;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid var(--color-voice-border, rgba(255,255,255,0.06))',
      }}>
        <span style={{ fontSize: 18 }}>👥</span>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Freunde</span>
        <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '4px 12px', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: tab === t.key ? 'rgba(200,168,74,0.15)' : 'transparent',
              color: tab === t.key ? 'var(--brand-primary, #c8a84a)' : t.key === 'add' ? 'var(--color-voice-online, #3ba55d)' : 'var(--text-muted)',
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {/* Add tab */}
        {tab === 'add' && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Freund hinzufuegen</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 12 }}>Gib den Benutzernamen ein.</p>
            {addMsg && <div style={{ color: addSuccess ? '#3ba55d' : '#ed4245', fontSize: 14, marginBottom: 8 }}>{addMsg}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={addUsername} onChange={(e) => setAddUsername(e.target.value)}
                placeholder="Benutzername" onKeyDown={(e) => e.key === 'Enter' && sendRequest()}
                style={{
                  flex: 1, padding: '8px 12px', background: 'var(--bg-secondary, #080b0f)',
                  border: '1px solid var(--color-border, #1e2733)', borderRadius: 4,
                  color: 'var(--text-primary)', fontSize: 14, outline: 'none',
                }}
              />
              <button onClick={sendRequest} style={{
                padding: '8px 16px', borderRadius: 4, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #c8a84a, #8a6e28)', color: '#080b0f', fontWeight: 700, fontSize: 14,
              }}>
                Senden
              </button>
            </div>
          </div>
        )}

        {/* Friends list */}
        {tab === 'all' && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
              Freunde — {friends.length}
            </div>
            {friends.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: 32 }}>
                Noch keine Freunde. Fuege jemanden hinzu!
              </div>
            ) : friends.map((f) => (
              <FriendRow key={f.id} rel={f} onDM={() => openDM(f.user_id, f.display_name || f.username)} onRemove={() => remove(f.id)} />
            ))}
          </>
        )}

        {/* Pending */}
        {tab === 'pending' && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
              Ausstehend — {pending.length}
            </div>
            {pending.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: 32 }}>
                Keine ausstehenden Anfragen.
              </div>
            ) : pending.map((p) => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 6,
                transition: 'background 0.1s',
              }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <UserAvatar user={{ username: p.username, display_name: p.display_name, avatar: p.avatar }} size={36} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{p.display_name || p.username}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.type === 3 ? 'Eingehend' : 'Ausgehend'}</div>
                </div>
                {p.type === 3 && (
                  <button onClick={() => accept(p.id)} style={{
                    background: 'rgba(59,165,93,0.2)', border: 'none', borderRadius: 50,
                    width: 32, height: 32, cursor: 'pointer', color: '#3ba55d', fontSize: 16,
                  }} title="Annehmen">✓</button>
                )}
                <button onClick={() => remove(p.id)} style={{
                  background: 'rgba(237,66,69,0.2)', border: 'none', borderRadius: 50,
                  width: 32, height: 32, cursor: 'pointer', color: '#ed4245', fontSize: 14,
                }} title="Ablehnen">✕</button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function FriendRow({ rel, onDM, onRemove }: { rel: Relationship; onDM: () => void; onRemove: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 6,
      transition: 'background 0.1s',
    }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <UserAvatar user={{ username: rel.username, display_name: rel.display_name, avatar: rel.avatar }} size={36} showStatus status="online" />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{rel.display_name || rel.username}</div>
        <div style={{ fontSize: 12, color: 'var(--color-voice-online, #3ba55d)' }}>Online</div>
      </div>
      <button onClick={onDM} title="Nachricht" style={{
        background: 'rgba(255,255,255,0.04)', border: 'none', borderRadius: 50,
        width: 32, height: 32, cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14,
      }}>💬</button>
      <button onClick={onRemove} title="Entfernen" style={{
        background: 'rgba(237,66,69,0.1)', border: 'none', borderRadius: 50,
        width: 32, height: 32, cursor: 'pointer', color: '#ed4245', fontSize: 12,
      }}>✕</button>
    </div>
  );
}
