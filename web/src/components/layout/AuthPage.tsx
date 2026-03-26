import { useState } from 'react';
import { useAuthStore } from '../../stores/auth';

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(username, email, password);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Etwas ist schiefgelaufen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>{isLogin ? 'Willkommen zurück!' : 'Konto erstellen'}</h1>
        <p>{isLogin ? 'Melde dich an, um Valhalla zu nutzen' : 'Tritt der Unterhaltung bei'}</p>

        {error && <div className="error-text">{error}</div>}

        {!isLogin && (
          <div className="form-group">
            <label>Benutzername</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={2}
              maxLength={32}
            />
          </div>
        )}

        <div className="form-group">
          <label>E-Mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Passwort</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>

        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Laden...' : isLogin ? 'Anmelden' : 'Registrieren'}
        </button>

        {isLogin && (
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <a style={{ color: 'var(--text-link)', cursor: 'pointer', fontSize: 13 }} onClick={() => {
              const email = prompt('E-Mail-Adresse für Passwort-Reset:');
              if (email) {
                fetch('/api/v1/auth/forgot-password', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email }),
                }).then(() => alert('Falls ein Konto mit dieser E-Mail existiert, wurde ein Reset-Link erstellt.')).catch(() => {});
              }
            }}>Passwort vergessen?</a>
          </div>
        )}

        <div className="auth-switch">
          {isLogin ? (
            <>Noch kein Konto? <a onClick={() => setIsLogin(false)}>Registrieren</a></>
          ) : (
            <>Bereits registriert? <a onClick={() => setIsLogin(true)}>Anmelden</a></>
          )}
        </div>
      </form>
    </div>
  );
}
