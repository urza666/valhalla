import { useState } from 'react';
import { api } from '../../api/client';
import { useAppStore } from '../../stores/app';

interface Props {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = useState<'welcome' | 'choice' | 'create' | 'join'>('welcome');
  const [serverName, setServerName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { createGuild, loadGuilds } = useAppStore();

  const handleCreate = async () => {
    if (!serverName.trim()) return;
    setLoading(true);
    setError('');
    try {
      await createGuild(serverName.trim());
      onComplete();
    } catch {
      setError('Server konnte nicht erstellt werden');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api.joinGuild(inviteCode.trim());
      await loadGuilds();
      onComplete();
    } catch {
      setError('Ungültiger oder abgelaufener Einladungscode');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="auth-form" style={{ textAlign: 'center', animation: 'slideUp 0.3s ease' }}>
        {step === 'welcome' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚔️</div>
            <h1>Willkommen bei Valhalla!</h1>
            <p style={{ marginBottom: 24 }}>Lass uns loslegen. Was möchtest du tun?</p>
            <button className="btn-primary" style={{ width: '100%', padding: '10px 16px' }} onClick={() => setStep('choice')}>Weiter</button>
          </>
        )}

        {step === 'choice' && (
          <>
            <h1>Wie möchtest du starten?</h1>
            <p style={{ marginBottom: 24 }}>Du kannst einen eigenen Server erstellen oder einem bestehenden beitreten.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button className="btn-primary" style={{ width: '100%', padding: '10px 16px' }} onClick={() => setStep('create')}>
                Server erstellen
              </button>
              <button className="btn-secondary" style={{ width: '100%', padding: '10px 16px' }} onClick={() => setStep('join')}>
                Server beitreten
              </button>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginTop: 8, fontSize: 14 }}
                onClick={onComplete}
              >
                Später entscheiden
              </button>
            </div>
          </>
        )}

        {step === 'create' && (
          <>
            <h1>Server erstellen</h1>
            <p>Gib deinem Server einen Namen</p>
            {error && <div className="error-text">{error}</div>}
            <div className="form-group" style={{ textAlign: 'left' }}>
              <label>Servername</label>
              <input
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="z.B. Mein Team"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
                maxLength={100}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary" onClick={() => setStep('choice')}>Zurück</button>
              <button className="btn-primary" onClick={handleCreate} disabled={loading || !serverName.trim()}>
                {loading ? 'Erstellen...' : 'Erstellen'}
              </button>
            </div>
          </>
        )}

        {step === 'join' && (
          <>
            <h1>Server beitreten</h1>
            <p>Gib einen Einladungscode ein</p>
            {error && <div className="error-text">{error}</div>}
            <div className="form-group" style={{ textAlign: 'left' }}>
              <label>Einladungscode</label>
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="z.B. a1b2c3d4e5"
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary" onClick={() => setStep('choice')}>Zurück</button>
              <button className="btn-primary" onClick={handleJoin} disabled={loading || !inviteCode.trim()}>
                {loading ? 'Beitreten...' : 'Beitreten'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
