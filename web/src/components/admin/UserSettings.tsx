import { useState } from 'react';
import { useAuthStore } from '../../stores/auth';

interface Props {
  onClose: () => void;
}

export function UserSettings({ onClose }: Props) {
  const [tab, setTab] = useState<'profile' | 'account' | 'sessions' | 'appearance'>('profile');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-sidebar">
          <div className="settings-sidebar-title">Benutzer-Einstellungen</div>
          <button className={`settings-tab ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}>Profil</button>
          <button className={`settings-tab ${tab === 'account' ? 'active' : ''}`} onClick={() => setTab('account')}>Konto</button>
          <button className={`settings-tab ${tab === 'sessions' ? 'active' : ''}`} onClick={() => setTab('sessions')}>Sitzungen</button>
          <div className="settings-tab-sep" />
          <button className={`settings-tab ${tab === 'appearance' ? 'active' : ''}`} onClick={() => setTab('appearance')}>Darstellung</button>
          <div className="settings-tab-sep" />
          <button className="settings-tab danger" onClick={() => { useAuthStore.getState().logout(); onClose(); }}>Abmelden</button>
        </div>
        <div className="settings-content">
          <button className="settings-close" onClick={onClose}>ESC</button>
          {tab === 'profile' && <ProfileTab />}
          {tab === 'account' && <AccountTab />}
          {tab === 'sessions' && <SessionsTab />}
          {tab === 'appearance' && <AppearanceTab />}
        </div>
      </div>
    </div>
  );
}

function ProfileTab() {
  const { user } = useAuthStore();
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await fetch('/api/v1/users/@me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ display_name: displayName || null, bio: bio || null }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    setSaving(false);
  };

  return (
    <div>
      <h2>Profil</h2>

      <div className="settings-profile-card">
        <div className="settings-avatar">
          {(user?.username || '?')[0].toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 20 }}>{displayName || user?.username}</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>@{user?.username}</div>
        </div>
      </div>

      <div className="form-group" style={{ marginTop: 24 }}>
        <label>Anzeigename</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={user?.username} maxLength={32} />
      </div>

      <div className="form-group">
        <label>Ueber mich</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Erzaehl etwas ueber dich..."
          maxLength={190}
          rows={3}
          style={{ width: '100%', padding: '10px 12px', border: 'none', borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'var(--font-primary)', resize: 'vertical' }}
        />
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{bio.length}/190</div>
      </div>

      <button className="btn" style={{ width: 'auto' }} onClick={save} disabled={saving}>
        {saved ? 'Gespeichert!' : saving ? 'Speichern...' : 'Aenderungen speichern'}
      </button>
    </div>
  );
}

function AccountTab() {
  const { user } = useAuthStore();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');

  const changePw = async () => {
    setPwMsg('');
    try {
      const res = await fetch('/api/v1/users/@me/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      });
      if (res.ok) {
        setPwMsg('Passwort geaendert!');
        setCurrentPw('');
        setNewPw('');
      } else {
        const data = await res.json();
        setPwMsg(data.message || 'Fehler');
      }
    } catch {
      setPwMsg('Fehler beim Aendern');
    }
  };

  return (
    <div>
      <h2>Konto</h2>

      <div className="form-group" style={{ marginTop: 20 }}>
        <label>Benutzername</label>
        <input value={user?.username || ''} readOnly style={{ opacity: 0.6 }} />
      </div>

      <div className="form-group">
        <label>E-Mail</label>
        <input value={user?.email || ''} readOnly style={{ opacity: 0.6 }} />
      </div>

      <div className="settings-tab-sep" style={{ margin: '24px 0' }} />

      <h3 style={{ fontSize: 16, marginBottom: 16 }}>Passwort aendern</h3>

      {pwMsg && <div style={{ color: pwMsg.includes('!') ? 'var(--success)' : 'var(--danger)', fontSize: 14, marginBottom: 12 }}>{pwMsg}</div>}

      <div className="form-group">
        <label>Aktuelles Passwort</label>
        <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
      </div>

      <div className="form-group">
        <label>Neues Passwort</label>
        <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Min. 8 Zeichen" />
      </div>

      <button className="btn" style={{ width: 'auto' }} onClick={changePw} disabled={!currentPw || newPw.length < 8}>
        Passwort aendern
      </button>
    </div>
  );
}

function SessionsTab() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  if (!loaded) {
    fetch('/api/v1/users/@me/sessions', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then((r) => r.json())
      .then((s) => { setSessions(s || []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }

  const revokeAll = async () => {
    await fetch('/api/v1/users/@me/sessions', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    // Reload
    setLoaded(false);
  };

  return (
    <div>
      <h2>Aktive Sitzungen</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
        Hier siehst du alle Geraete auf denen du eingeloggt bist.
      </p>

      <div className="settings-list">
        {sessions.map((s, i) => (
          <div key={i} className="settings-list-item">
            <div>
              <div style={{ fontWeight: 600 }}>
                {s.current ? '(Aktuelle Sitzung) ' : ''}{s.token}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {s.ip_address || 'Unbekannt'} — {s.created_at?.split('T')[0]}
              </div>
            </div>
          </div>
        ))}
      </div>

      {sessions.length > 1 && (
        <button className="btn" style={{ width: 'auto', marginTop: 16, background: 'var(--danger)' }} onClick={revokeAll}>
          Alle anderen Sitzungen beenden
        </button>
      )}
    </div>
  );
}

function AppearanceTab() {
  const settings = (() => {
    return {
      theme: localStorage.getItem('theme') || 'dark',
      fontSize: Number(localStorage.getItem('font_size')) || 16,
      desktopNotifications: localStorage.getItem('notif_desktop') !== 'false',
      notificationSound: localStorage.getItem('notif_sound') !== 'false',
    };
  })();

  const [theme, setTheme] = useState(settings.theme);
  const [fontSize, setFontSize] = useState(settings.fontSize);
  const [desktopNotif, setDesktopNotif] = useState(settings.desktopNotifications);
  const [notifSound, setNotifSound] = useState(settings.notificationSound);

  const applyTheme = (t: string) => {
    setTheme(t);
    localStorage.setItem('theme', t);
    document.documentElement.setAttribute('data-theme', t);
  };

  return (
    <div>
      <h2>Darstellung</h2>

      <div className="form-group" style={{ marginTop: 20 }}>
        <label>Theme</label>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => applyTheme('dark')}
            style={{ background: '#313338', color: '#f2f3f5', border: theme === 'dark' ? '2px solid var(--brand-primary)' : '2px solid var(--border-subtle)', borderRadius: 8, padding: '12px 24px', cursor: 'pointer', fontWeight: 600 }}
          >
            🌙 Dark
          </button>
          <button
            className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
            onClick={() => applyTheme('light')}
            style={{ background: '#ffffff', color: '#060607', border: theme === 'light' ? '2px solid var(--brand-primary)' : '2px solid #e1e1e4', borderRadius: 8, padding: '12px 24px', cursor: 'pointer', fontWeight: 600 }}
          >
            ☀️ Light
          </button>
        </div>
      </div>

      <div className="form-group">
        <label>Schriftgroesse: {fontSize}px</label>
        <input
          type="range" min={12} max={20} value={fontSize}
          onChange={(e) => {
            const size = Number(e.target.value);
            setFontSize(size);
            localStorage.setItem('font_size', String(size));
            document.documentElement.style.fontSize = size + 'px';
          }}
          style={{ width: '100%' }}
        />
      </div>

      <div className="settings-tab-sep" style={{ margin: '24px 0' }} />

      <h3 style={{ fontSize: 16, marginBottom: 16 }}>Benachrichtigungen</h3>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)' }}>
        <input type="checkbox" checked={desktopNotif} onChange={() => {
          const next = !desktopNotif;
          setDesktopNotif(next);
          localStorage.setItem('notif_desktop', String(next));
          if (next && 'Notification' in window) Notification.requestPermission();
        }} />
        Desktop-Benachrichtigungen
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)' }}>
        <input type="checkbox" checked={notifSound} onChange={() => {
          const next = !notifSound;
          setNotifSound(next);
          localStorage.setItem('notif_sound', String(next));
        }} />
        Benachrichtigungston
      </label>
    </div>
  );
}
