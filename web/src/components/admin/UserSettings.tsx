import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../stores/auth';
import { useVoiceStore } from '../../stores/voice';

interface Props {
  onClose: () => void;
}

export function UserSettings({ onClose }: Props) {
  const [tab, setTab] = useState<'profile' | 'account' | 'sessions' | 'appearance' | 'voice'>('profile');

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
          <button className={`settings-tab ${tab === 'voice' ? 'active' : ''}`} onClick={() => setTab('voice')}>Sprache & Video</button>
          <div className="settings-tab-sep" />
          <button className="settings-tab danger" onClick={() => { useAuthStore.getState().logout(); onClose(); }}>Abmelden</button>
        </div>
        <div className="settings-content">
          <button className="settings-close" onClick={onClose}>ESC</button>
          {tab === 'profile' && <ProfileTab />}
          {tab === 'account' && <AccountTab />}
          {tab === 'sessions' && <SessionsTab />}
          {tab === 'appearance' && <AppearanceTab />}
          {tab === 'voice' && <VoiceVideoTab />}
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
        <label>Über mich</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Erzähl etwas über dich..."
          maxLength={190}
          rows={3}
          style={{ width: '100%', padding: '10px 12px', border: 'none', borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'var(--font-primary)', resize: 'vertical' }}
        />
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{bio.length}/190</div>
      </div>

      <button className="btn" style={{ width: 'auto' }} onClick={save} disabled={saving}>
        {saved ? 'Gespeichert!' : saving ? 'Speichern...' : 'Änderungen speichern'}
      </button>
    </div>
  );
}

function AccountTab() {
  const { user } = useAuthStore();
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  const changePw = async () => {
    setPwMsg('');
    setPwSuccess(false);
    try {
      const res = await fetch('/api/v1/users/@me/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      });
      if (res.ok) {
        setPwMsg('Passwort geändert!');
        setPwSuccess(true);
        setCurrentPw('');
        setNewPw('');
      } else {
        const data = await res.json();
        setPwMsg(data.message || 'Falsches Passwort oder ungültige Eingabe');
      }
    } catch {
      setPwMsg('Verbindungsfehler — bitte erneut versuchen');
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

      <h3 style={{ fontSize: 16, marginBottom: 16 }}>Passwort ändern</h3>

      {pwMsg && <div style={{ color: pwSuccess ? 'var(--success)' : 'var(--danger)', fontSize: 14, marginBottom: 12 }}>{pwMsg}</div>}

      <div className="form-group">
        <label>Aktuelles Passwort</label>
        <input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
      </div>

      <div className="form-group">
        <label>Neues Passwort</label>
        <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Min. 8 Zeichen" />
      </div>

      <button className="btn" style={{ width: 'auto' }} onClick={changePw} disabled={!currentPw || newPw.length < 8}>
        Passwort ändern
      </button>

      <div className="settings-tab-sep" style={{ margin: '24px 0' }} />

      <h3 style={{ fontSize: 16, marginBottom: 16, color: 'var(--danger)' }}>Konto löschen</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 12 }}>
        Dein Konto und alle zugehörigen Daten werden unwiderruflich gelöscht. Nachrichten bleiben anonym erhalten.
      </p>
      <button
        className="btn"
        style={{ width: 'auto', background: 'var(--danger)' }}
        onClick={async () => {
          const pw = prompt('Gib dein Passwort ein, um das Konto zu löschen:');
          if (!pw) return;
          if (!confirm('Bist du sicher? Diese Aktion kann nicht rückgängig gemacht werden.')) return;
          try {
            await fetch('/api/v1/users/@me/delete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
              body: JSON.stringify({ password: pw }),
            });
            localStorage.removeItem('token');
            window.location.reload();
          } catch {
            alert('Fehler beim Löschen des Kontos');
          }
        }}
      >
        Konto unwiderruflich löschen
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
        Hier siehst du alle Geräte, auf denen du eingeloggt bist.
      </p>

      <div className="settings-list">
        {sessions.map((s, i) => (
          <div key={i} className="settings-list-item">
            <div>
              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                {s.current && <span style={{ fontSize: 12, padding: '2px 6px', borderRadius: 3, background: 'var(--status-online)', color: '#fff' }}>Aktiv</span>}
                Sitzung {i + 1}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {s.ip_address || 'Unbekannte IP'} — {s.created_at ? new Date(s.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Unbekannt'}
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
            🌙 Dunkel
          </button>
          <button
            className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
            onClick={() => applyTheme('light')}
            style={{ background: '#ffffff', color: '#060607', border: theme === 'light' ? '2px solid var(--brand-primary)' : '2px solid #e1e1e4', borderRadius: 8, padding: '12px 24px', cursor: 'pointer', fontWeight: 600 }}
          >
            ☀️ Hell
          </button>
        </div>
      </div>

      <div className="form-group">
        <label>Schriftgröße: {fontSize}px</label>
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

// Voice & Video settings tab with device selection and self-test
function VoiceVideoTab() {
  const {
    audioInputDevice, audioOutputDevice, videoInputDevice,
    inputVolume, outputVolume,
    setAudioInputDevice, setAudioOutputDevice, setVideoInputDevice,
    setInputVolume, setOutputVolume,
  } = useVoiceStore();

  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [micLevel, setMicLevel] = useState(0);
  const [testingMic, setTestingMic] = useState(false);
  const [testingOutput, setTestingOutput] = useState(false);
  const [cameraPreview, setCameraPreview] = useState(false);

  const micStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const [devicesError, setDevicesError] = useState('');

  // Load available devices — request audio and video permissions separately
  useEffect(() => {
    const loadDevices = async () => {
      try {
        // Try audio first (most likely to succeed)
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioStream.getTracks().forEach(t => t.stop());
        } catch {
          setDevicesError('Mikrofon-Zugriff verweigert. Bitte Berechtigungen in den Browser-Einstellungen prüfen.');
        }

        // Try video separately (may fail without camera)
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          videoStream.getTracks().forEach(t => t.stop());
        } catch {
          // No camera is fine — just won't show video devices
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devices.filter(d => d.kind === 'audioinput'));
        setAudioOutputs(devices.filter(d => d.kind === 'audiooutput'));
        setVideoInputs(devices.filter(d => d.kind === 'videoinput'));
      } catch {
        setDevicesError('Geräte konnten nicht geladen werden');
      }
    };
    loadDevices();

    return () => {
      stopMicTest();
      stopCameraPreview();
    };
  }, []);

  const startMicTest = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: audioInputDevice && audioInputDevice !== 'default'
          ? { deviceId: { ideal: audioInputDevice } }
          : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      micStreamRef.current = stream;

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      setTestingMic(true);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
        setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    } catch {
      // Permission denied
    }
  }, [audioInputDevice]);

  const stopMicTest = useCallback(() => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    analyserRef.current = null;
    setTestingMic(false);
    setMicLevel(0);
  }, []);

  const testOutputAudio = useCallback(() => {
    setTestingOutput(true);
    const audioCtx = new AudioContext();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.frequency.value = 440;
    gainNode.gain.value = 0.1 * (outputVolume / 100);
    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      audioCtx.close();
      setTestingOutput(false);
    }, 1000);
  }, [outputVolume]);

  const startCameraPreview = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: videoInputDevice ? { exact: videoInputDevice } : undefined },
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraPreview(true);
    } catch {
      // Permission denied
    }
  }, [videoInputDevice]);

  const stopCameraPreview = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraPreview(false);
  }, []);

  return (
    <div>
      <h2>Sprache & Video</h2>

      {devicesError && (
        <div style={{ background: 'rgba(242,63,67,0.1)', border: '1px solid var(--danger)', borderRadius: 4, padding: '8px 12px', marginTop: 12, marginBottom: 12, fontSize: 13, color: 'var(--danger)' }}>
          {devicesError}
        </div>
      )}

      {/* Input device */}
      <div className="form-group" style={{ marginTop: 20 }}>
        <label>Eingabegerät (Mikrofon)</label>
        <select
          value={audioInputDevice}
          onChange={(e) => setAudioInputDevice(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', border: 'none', borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 14 }}
        >
          <option value="default">Standard</option>
          {audioInputs.map(d => (
            <option key={d.deviceId} value={d.deviceId}>{d.label || `Mikrofon ${d.deviceId.slice(0, 8)}`}</option>
          ))}
        </select>
      </div>

      {/* Input volume */}
      <div className="form-group">
        <label>Eingangs-Lautstärke: {inputVolume}%</label>
        <input type="range" min={0} max={200} value={inputVolume} onChange={(e) => setInputVolume(Number(e.target.value))} style={{ width: '100%' }} />
      </div>

      {/* Mic test */}
      <div className="form-group">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="btn"
            style={{ width: 'auto', fontSize: 13, padding: '6px 16px' }}
            onClick={testingMic ? stopMicTest : startMicTest}
          >
            {testingMic ? 'Test beenden' : 'Mikrofontest starten'}
          </button>
          {testingMic && (
            <div style={{ flex: 1, height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${micLevel}%`, height: '100%',
                background: micLevel > 70 ? 'var(--danger)' : micLevel > 30 ? 'var(--status-idle)' : 'var(--status-online)',
                transition: 'width 50ms',
                borderRadius: 4,
              }} />
            </div>
          )}
        </div>
      </div>

      <div className="settings-tab-sep" style={{ margin: '24px 0' }} />

      {/* Output device */}
      <div className="form-group">
        <label>Ausgabegerät (Lautsprecher/Kopfhörer)</label>
        <select
          value={audioOutputDevice}
          onChange={(e) => setAudioOutputDevice(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', border: 'none', borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 14 }}
        >
          <option value="default">Standard</option>
          {audioOutputs.map(d => (
            <option key={d.deviceId} value={d.deviceId}>{d.label || `Lautsprecher ${d.deviceId.slice(0, 8)}`}</option>
          ))}
        </select>
      </div>

      {/* Output volume */}
      <div className="form-group">
        <label>Ausgangs-Lautstärke: {outputVolume}%</label>
        <input type="range" min={0} max={200} value={outputVolume} onChange={(e) => setOutputVolume(Number(e.target.value))} style={{ width: '100%' }} />
      </div>

      {/* Output test */}
      <div className="form-group">
        <button
          className="btn"
          style={{ width: 'auto', fontSize: 13, padding: '6px 16px' }}
          onClick={testOutputAudio}
          disabled={testingOutput}
        >
          {testingOutput ? 'Wird abgespielt...' : 'Audiotest abspielen'}
        </button>
      </div>

      <div className="settings-tab-sep" style={{ margin: '24px 0' }} />

      {/* Video device */}
      <h3 style={{ fontSize: 16, marginBottom: 16 }}>Kamera</h3>

      <div className="form-group">
        <label>Kamera</label>
        <select
          value={videoInputDevice}
          onChange={(e) => {
            setVideoInputDevice(e.target.value);
            if (cameraPreview) {
              stopCameraPreview();
              setTimeout(() => startCameraPreview(), 100);
            }
          }}
          style={{ width: '100%', padding: '10px 12px', border: 'none', borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 14 }}
        >
          <option value="">Standard</option>
          {videoInputs.map(d => (
            <option key={d.deviceId} value={d.deviceId}>{d.label || `Kamera ${d.deviceId.slice(0, 8)}`}</option>
          ))}
        </select>
      </div>

      {/* Camera preview */}
      <div className="form-group">
        <button
          className="btn"
          style={{ width: 'auto', fontSize: 13, padding: '6px 16px', marginBottom: 12 }}
          onClick={cameraPreview ? stopCameraPreview : startCameraPreview}
        >
          {cameraPreview ? 'Vorschau beenden' : 'Kameravorschau'}
        </button>

        {cameraPreview && (
          <div style={{ borderRadius: 8, overflow: 'hidden', background: '#000', maxWidth: 400 }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', display: 'block', transform: 'scaleX(-1)' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
