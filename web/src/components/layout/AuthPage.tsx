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
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>{isLogin ? 'Welcome back!' : 'Create an account'}</h1>
        <p>{isLogin ? 'Sign in to continue to Valhalla' : 'Join the conversation'}</p>

        {error && <div className="error-text">{error}</div>}

        {!isLogin && (
          <div className="form-group">
            <label>Username</label>
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
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>

        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Loading...' : isLogin ? 'Log In' : 'Register'}
        </button>

        <div className="auth-switch">
          {isLogin ? (
            <>Need an account? <a onClick={() => setIsLogin(false)}>Register</a></>
          ) : (
            <>Already have an account? <a onClick={() => setIsLogin(true)}>Log In</a></>
          )}
        </div>
      </form>
    </div>
  );
}
