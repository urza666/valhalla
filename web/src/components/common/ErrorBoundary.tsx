import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)',
          color: 'var(--text-primary)', fontFamily: 'var(--font-primary)',
          padding: 24, textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Etwas ist schiefgelaufen</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24, maxWidth: 400 }}>
            Ein unerwarteter Fehler ist aufgetreten. Versuche die Seite neu zu laden.
          </p>
          {this.state.error && (
            <pre style={{
              background: 'var(--bg-tertiary)', padding: '12px 16px', borderRadius: 4,
              fontSize: 12, color: 'var(--danger)', maxWidth: 600, overflow: 'auto',
              marginBottom: 24, textAlign: 'left',
            }}>
              {this.state.error.message}
            </pre>
          )}
          <button
            style={{
              background: 'var(--brand-primary)', color: '#fff', border: 'none',
              borderRadius: 4, padding: '10px 24px', fontSize: 16, cursor: 'pointer',
              fontWeight: 600,
            }}
            onClick={() => window.location.reload()}
          >
            Seite neu laden
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
