import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { Relationship } from '../../api/client';

export function FriendsView() {
  const [rels, setRels] = useState<Relationship[]>([]);
  const [tab, setTab] = useState<'all' | 'online' | 'pending' | 'blocked' | 'add'>('all');
  const [addUsername, setAddUsername] = useState('');
  const [addMsg, setAddMsg] = useState('');
  const [addSuccess, setAddSuccess] = useState(false);

  useEffect(() => {
    api.getRelationships().then(setRels).catch(() => {});
  }, []);

  const friends = rels.filter((r) => r.type === 1);
  const pending = rels.filter((r) => r.type === 3 || r.type === 4);
  const blocked = rels.filter((r) => r.type === 2);

  const sendRequest = async () => {
    if (!addUsername.trim()) return;
    setAddMsg('');
    setAddSuccess(false);
    try {
      await api.sendFriendRequest(addUsername.trim());
      setAddMsg('Freundschaftsanfrage gesendet!');
      setAddSuccess(true);
      setAddUsername('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Fehler beim Senden der Anfrage';
      setAddMsg(message);
      setAddSuccess(false);
    }
  };

  const accept = async (targetId: string) => {
    try {
      await api.acceptFriendRequest(targetId);
      setRels(rels.map((r) => r.id === targetId ? { ...r, type: 1 } : r));
    } catch { /* ignore */ }
  };

  const remove = async (targetId: string) => {
    try {
      await api.removeRelationship(targetId);
      setRels(rels.filter((r) => r.id !== targetId));
    } catch { /* ignore */ }
  };

  const unblock = async (targetId: string) => {
    try {
      await api.unblockUser(targetId);
      setRels(rels.filter((r) => r.id !== targetId));
    } catch { /* ignore */ }
  };

  return (
    <div className="chat-area">
      <div className="chat-header">
        <span style={{ fontSize: 18 }}>👥</span>
        Freunde
        <div style={{ display: 'flex', gap: 4, marginLeft: 16 }}>
          {(['all', 'online', 'pending', 'blocked', 'add'] as const).map((t) => (
            <button
              key={t}
              className={`friends-tab ${tab === t ? 'active' : ''} ${t === 'add' ? 'green' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'all' ? 'Alle' : t === 'online' ? 'Online' : t === 'pending' ? `Ausstehend${pending.length ? ` (${pending.length})` : ''}` : t === 'blocked' ? 'Blockiert' : 'Hinzufügen'}
            </button>
          ))}
        </div>
      </div>

      <div className="friends-content">
        {/* Add friend */}
        {tab === 'add' && (
          <div className="friends-add">
            <h3>Freund hinzufügen</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 12 }}>
              Gib den Benutzernamen der Person ein.
            </p>
            {addMsg && <div style={{ color: addSuccess ? 'var(--success)' : 'var(--danger)', fontSize: 14, marginBottom: 8 }}>{addMsg}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={addUsername}
                onChange={(e) => setAddUsername(e.target.value)}
                placeholder="Benutzername"
                onKeyDown={(e) => e.key === 'Enter' && sendRequest()}
                style={{ flex: 1 }}
              />
              <button className="btn" style={{ width: 'auto' }} onClick={sendRequest}>
                Anfrage senden
              </button>
            </div>
          </div>
        )}

        {/* Friends list */}
        {(tab === 'all' || tab === 'online') && (
          <>
            <div className="friends-section-title">Freunde — {friends.length}</div>
            {friends.length === 0 ? (
              <div className="friends-empty">Noch keine Freunde. Füge jemanden hinzu!</div>
            ) : (
              friends.map((f) => (
                <div key={f.id} className="friend-item">
                  <div className="friend-avatar">{f.username[0].toUpperCase()}</div>
                  <div className="friend-info">
                    <div className="friend-name">{f.display_name || f.username}</div>
                    <div className="friend-status">Online</div>
                  </div>
                  <div className="friend-actions">
                    <button className="btn-small" title="Nachricht" aria-label="Nachricht senden">💬</button>
                    <button className="btn-small danger" onClick={() => remove(f.id)} title="Entfernen" aria-label="Freund entfernen">✕</button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* Pending requests */}
        {tab === 'pending' && (
          <>
            <div className="friends-section-title">Ausstehend — {pending.length}</div>
            {pending.length === 0 ? (
              <div className="friends-empty">Keine ausstehenden Anfragen.</div>
            ) : (
              pending.map((p) => (
                <div key={p.id} className="friend-item">
                  <div className="friend-avatar">{p.username[0].toUpperCase()}</div>
                  <div className="friend-info">
                    <div className="friend-name">{p.display_name || p.username}</div>
                    <div className="friend-status">{p.type === 3 ? 'Eingehende Anfrage' : 'Ausgehende Anfrage'}</div>
                  </div>
                  <div className="friend-actions">
                    {p.type === 3 && <button className="btn-small" style={{ color: 'var(--success)' }} onClick={() => accept(p.id)} aria-label="Anfrage annehmen">✓</button>}
                    <button className="btn-small danger" onClick={() => remove(p.id)} aria-label="Anfrage ablehnen">✕</button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* Blocked */}
        {tab === 'blocked' && (
          <>
            <div className="friends-section-title">Blockiert — {blocked.length}</div>
            {blocked.length === 0 ? (
              <div className="friends-empty">Niemand blockiert.</div>
            ) : (
              blocked.map((b) => (
                <div key={b.id} className="friend-item">
                  <div className="friend-avatar">{b.username[0].toUpperCase()}</div>
                  <div className="friend-info">
                    <div className="friend-name">{b.display_name || b.username}</div>
                  </div>
                  <button className="btn-small" onClick={() => unblock(b.id)}>Entsperren</button>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
