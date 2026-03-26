import { useEffect, useState } from 'react';

interface Relationship {
  id: string;
  user_id: string;
  type: number; // 1=friend, 2=blocked, 3=pending_incoming, 4=pending_outgoing
  username: string;
  display_name: string | null;
  avatar: string | null;
}

const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('token')}`,
  'Content-Type': 'application/json',
});

export function FriendsView() {
  const [rels, setRels] = useState<Relationship[]>([]);
  const [tab, setTab] = useState<'all' | 'online' | 'pending' | 'blocked' | 'add'>('all');
  const [addUsername, setAddUsername] = useState('');
  const [addMsg, setAddMsg] = useState('');

  useEffect(() => {
    fetch('/api/v1/users/@me/relationships', { headers: headers() })
      .then((r) => r.json())
      .then(setRels)
      .catch(() => {});
  }, []);

  const friends = rels.filter((r) => r.type === 1);
  const pending = rels.filter((r) => r.type === 3 || r.type === 4);
  const blocked = rels.filter((r) => r.type === 2);

  const sendRequest = async () => {
    if (!addUsername.trim()) return;
    setAddMsg('');
    try {
      const res = await fetch('/api/v1/users/@me/relationships', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ username: addUsername.trim() }),
      });
      if (res.ok) {
        setAddMsg('Freundschaftsanfrage gesendet!');
        setAddUsername('');
      } else {
        const data = await res.json();
        setAddMsg(data.message || 'Fehler');
      }
    } catch { setAddMsg('Fehler'); }
  };

  const accept = async (targetId: string) => {
    await fetch(`/api/v1/users/@me/relationships/${targetId}`, { method: 'PUT', headers: headers() });
    setRels(rels.map((r) => r.id === targetId ? { ...r, type: 1 } : r));
  };

  const remove = async (targetId: string) => {
    await fetch(`/api/v1/users/@me/relationships/${targetId}`, { method: 'DELETE', headers: headers() });
    setRels(rels.filter((r) => r.id !== targetId));
  };

  const unblock = async (targetId: string) => {
    await fetch(`/api/v1/users/@me/blocks/${targetId}`, { method: 'DELETE', headers: headers() });
    setRels(rels.filter((r) => r.id !== targetId));
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
              {t === 'all' ? 'Alle' : t === 'online' ? 'Online' : t === 'pending' ? `Ausstehend${pending.length ? ` (${pending.length})` : ''}` : t === 'blocked' ? 'Blockiert' : 'Hinzufuegen'}
            </button>
          ))}
        </div>
      </div>

      <div className="friends-content">
        {/* Add friend */}
        {tab === 'add' && (
          <div className="friends-add">
            <h3>Freund hinzufuegen</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 12 }}>
              Gib den Benutzernamen der Person ein.
            </p>
            {addMsg && <div style={{ color: addMsg.includes('!') ? 'var(--success)' : 'var(--danger)', fontSize: 14, marginBottom: 8 }}>{addMsg}</div>}
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
              <div className="friends-empty">Noch keine Freunde. Fuege jemanden hinzu!</div>
            ) : (
              friends.map((f) => (
                <div key={f.id} className="friend-item">
                  <div className="friend-avatar">{f.username[0].toUpperCase()}</div>
                  <div className="friend-info">
                    <div className="friend-name">{f.display_name || f.username}</div>
                    <div className="friend-status">Online</div>
                  </div>
                  <div className="friend-actions">
                    <button className="btn-small" title="Nachricht">💬</button>
                    <button className="btn-small danger" onClick={() => remove(f.id)} title="Entfernen">✕</button>
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
                    {p.type === 3 && <button className="btn-small" style={{ color: 'var(--success)' }} onClick={() => accept(p.id)}>✓</button>}
                    <button className="btn-small danger" onClick={() => remove(p.id)}>✕</button>
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
