/**
 * InviteModal — LPP-identical invite dialog with link generation.
 */
import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { toast } from '../../stores/toast';
import { Modal } from '../../components/ui/Modal';

interface Props {
  channelId: string;
  channelName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function InviteModal({ channelId, channelName, isOpen, onClose }: Props) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) { setCode(null); setCopied(false); return; }
    generateInvite();
  }, [isOpen, channelId]);

  const generateInvite = async () => {
    setLoading(true);
    try {
      const res = await api.createInvite(channelId);
      setCode(res.code);
    } catch { toast.error('Einladung konnte nicht erstellt werden'); }
    setLoading(false);
  };

  const inviteUrl = code ? `${window.location.origin}/invite/${code}` : '';

  const copyLink = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    toast.success('Link kopiert!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Freunde zu #${channelName} einladen`} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Teile diesen Link, damit andere dem Server beitreten koennen.
        </p>

        {loading ? (
          <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>Erstelle Einladung...</div>
        ) : code ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={inviteUrl} readOnly
              style={{
                flex: 1, padding: '10px 14px',
                background: 'var(--bg-secondary, #080b0f)',
                border: '1px solid var(--color-border)',
                borderRadius: 4, color: 'var(--text-primary)',
                fontSize: 14, outline: 'none',
                fontFamily: 'var(--font-code, monospace)',
              }}
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button onClick={copyLink} style={{
              padding: '10px 20px', borderRadius: 4, border: 'none', cursor: 'pointer',
              background: copied ? '#3ba55d' : 'linear-gradient(135deg, #c8a84a, #8a6e28)',
              color: copied ? '#fff' : '#080b0f', fontWeight: 700, fontSize: 14,
              transition: 'background 0.2s',
              minWidth: 100,
            }}>
              {copied ? '✓ Kopiert' : 'Kopieren'}
            </button>
          </div>
        ) : (
          <div style={{ padding: 16, textAlign: 'center', color: '#ed4245' }}>Fehler beim Erstellen</div>
        )}

        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Einladungen laufen nach 7 Tagen ab.
        </div>
      </div>
    </Modal>
  );
}
