import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useAppStore } from '../../stores/app';
import { toast } from '../../stores/toast';

interface Props {
  channelId: string;
  onClose: () => void;
}

export function InviteDialog({ channelId, onClose }: Props) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.createInvite(channelId).then((data) => {
      if (!cancelled) setCode(data.code);
    }).catch(() => {
      if (!cancelled) toast.error('Einladung konnte nicht erstellt werden');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [channelId]);

  const copyLink = () => {
    if (code) {
      const link = `${window.location.origin}/invite/${code}`;
      navigator.clipboard.writeText(link).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="auth-form" onClick={(e) => e.stopPropagation()} style={{ width: 440 }}>
        <h1 style={{ fontSize: 20 }}>Freunde einladen</h1>
        <p>Teile diesen Link, um Leute einzuladen:</p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div className="loading-spinner" style={{ margin: '0 auto' }} />
            <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>Erstelle Einladung...</p>
          </div>
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
              Einladungscode: <strong>{code}</strong> (läuft in 24 Stunden ab)
            </p>
          </>
        ) : (
          <p style={{ textAlign: 'center', color: 'var(--danger)' }}>Fehler beim Erstellen</p>
        )}

        <div className="settings-tab-sep" style={{ margin: '16px 0' }} />

        <h3 style={{ fontSize: 15, marginBottom: 8 }}>Einem Server beitreten</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Einladungscode oder Link einfügen"
            onKeyDown={(e) => { if (e.key === 'Enter') handleJoinServer(); }}
            style={{ flex: 1 }}
          />
          <button className="btn" style={{ width: 'auto', padding: '8px 16px', fontSize: 14 }} onClick={handleJoinServer} disabled={!joinCode.trim()}>
            Beitreten
          </button>
        </div>
      </div>
    </div>
  );

  async function handleJoinServer() {
    const trimmed = joinCode.trim();
    if (!trimmed) return;
    const codeMatch = trimmed.match(/(?:invite|join)\/([A-Za-z0-9_-]+)/);
    const finalCode = codeMatch ? codeMatch[1] : trimmed;
    try {
      const data = await api.joinGuild(finalCode);
      toast.success(`Server "${data.guild.name}" beigetreten!`);
      useAppStore.getState().loadGuilds();
      onClose();
    } catch (err: any) {
      if (err?.status === 409) {
        toast.info('Du bist bereits Mitglied dieses Servers');
      } else {
        toast.error('Einladung ungültig oder abgelaufen');
      }
    }
  }
}
