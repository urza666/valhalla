import { useState } from 'react';

interface Props {
  channelId: string;
  onClose: () => void;
}

export function InviteDialog({ channelId, onClose }: Props) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const createInvite = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/channels/${channelId}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ max_age: 86400, max_uses: 0 }),
      });
      const data = await res.json();
      setCode(data.code);
    } catch {
      /* ignore */
    }
    setLoading(false);
  };

  const copyLink = () => {
    if (code) {
      const link = `${window.location.origin}/invite/${code}`;
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!code) {
    createInvite();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="auth-form" onClick={(e) => e.stopPropagation()} style={{ width: 440 }}>
        <h1 style={{ fontSize: 20 }}>Freunde einladen</h1>
        <p>Teile diesen Link um Leute einzuladen:</p>

        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Erstelle Einladung...</p>
        ) : code ? (
          <>
            <div style={{
              background: 'var(--bg-tertiary)', borderRadius: 4, padding: '10px 12px',
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
            }}>
              <input
                readOnly
                value={`${window.location.origin}/invite/${code}`}
                style={{
                  flex: 1, background: 'none', border: 'none', color: 'var(--text-primary)',
                  fontSize: 14, outline: 'none',
                }}
              />
              <button className="btn" style={{ width: 'auto', padding: '8px 16px', fontSize: 14 }} onClick={copyLink}>
                {copied ? 'Kopiert!' : 'Kopieren'}
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Einladungscode: <strong>{code}</strong> (lauft in 24 Stunden ab)
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
