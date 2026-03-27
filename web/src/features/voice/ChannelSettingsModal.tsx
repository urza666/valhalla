/**
 * ChannelSettingsModal — LPP-identical channel settings.
 * Name, Topic, NSFW, Slow-Mode, Bitrate (voice), Delete.
 */
import { useState } from 'react';
import { api } from '../../api/client';
import { useAppStore } from '../../stores/app';
import { toast } from '../../stores/toast';
import { Modal } from '../../components/ui/Modal';
import type { Channel } from '../../api/client';

interface Props {
  channel: Channel;
  isOpen: boolean;
  onClose: () => void;
}

export function ChannelSettingsModal({ channel, isOpen, onClose }: Props) {
  const [name, setName] = useState(channel.name || '');
  const [topic, setTopic] = useState(channel.topic || '');
  const [nsfw, setNsfw] = useState(channel.nsfw || false);
  const [slowMode, setSlowMode] = useState(channel.rate_limit_per_user || 0);
  const [bitrate, setBitrate] = useState(channel.bitrate || 64000);
  const [saving, setSaving] = useState(false);
  const isVoice = channel.type === 2;

  const save = async () => {
    setSaving(true);
    try {
      await api.updateChannel(channel.id, {
        name: name.trim() || undefined,
        topic: topic.trim() || undefined,
        nsfw,
        rate_limit_per_user: slowMode,
        ...(isVoice ? { bitrate } : {}),
      });
      useAppStore.getState().loadGuilds();
      toast.success('Kanal aktualisiert');
      onClose();
    } catch { toast.error('Speichern fehlgeschlagen'); }
    setSaving(false);
  };

  const deleteChannel = async () => {
    if (!confirm(`Kanal "${channel.name}" loeschen?`)) return;
    try {
      await api.deleteChannel(channel.id);
      useAppStore.getState().loadGuilds();
      onClose();
      toast.success('Kanal geloescht');
    } catch { toast.error('Loeschen fehlgeschlagen'); }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`# ${channel.name} — Einstellungen`} size="md">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Name */}
        <Field label="Kanalname">
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </Field>

        {/* Topic (text only) */}
        {!isVoice && (
          <Field label="Thema">
            <textarea value={topic} onChange={(e) => setTopic(e.target.value)} rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Worum geht es in diesem Kanal?" />
          </Field>
        )}

        {/* NSFW */}
        {!isVoice && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ flex: 1, fontSize: 14, color: 'var(--text-secondary)' }}>NSFW-Kanal</label>
            <button onClick={() => setNsfw(!nsfw)} style={{
              width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: nsfw ? '#3ba55d' : 'var(--bg-secondary, #080b0f)',
              position: 'relative', transition: 'background 0.2s',
            }}>
              <div style={{
                width: 18, height: 18, borderRadius: 9, background: '#fff',
                position: 'absolute', top: 3,
                left: nsfw ? 23 : 3, transition: 'left 0.2s',
              }} />
            </button>
          </div>
        )}

        {/* Slow Mode */}
        {!isVoice && (
          <Field label={`Slow-Mode: ${slowMode}s`}>
            <input type="range" min={0} max={120} step={5} value={slowMode}
              onChange={(e) => setSlowMode(Number(e.target.value))} style={{ width: '100%' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
              <span>Aus</span><span>5s</span><span>30s</span><span>60s</span><span>120s</span>
            </div>
          </Field>
        )}

        {/* Bitrate (voice only) */}
        {isVoice && (
          <Field label={`Bitrate: ${Math.round(bitrate / 1000)} kbps`}>
            <input type="range" min={8000} max={384000} step={8000} value={bitrate}
              onChange={(e) => setBitrate(Number(e.target.value))} style={{ width: '100%' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
              <span>8 kbps</span><span>64</span><span>128</span><span>256</span><span>384 kbps</span>
            </div>
          </Field>
        )}

        {/* Save */}
        <button onClick={save} disabled={saving} style={{
          padding: '10px 20px', borderRadius: 4, border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #c8a84a, #8a6e28)', color: '#080b0f', fontWeight: 700, fontSize: 14,
          opacity: saving ? 0.5 : 1,
        }}>
          {saving ? 'Speichern...' : 'Aenderungen speichern'}
        </button>

        {/* Delete */}
        <div style={{ marginTop: 8, paddingTop: 12, borderTop: '1px solid rgba(237,66,69,0.2)' }}>
          <button onClick={deleteChannel} style={{
            padding: '8px 16px', borderRadius: 4, border: 'none', cursor: 'pointer',
            background: 'rgba(237,66,69,0.15)', color: '#ed4245', fontWeight: 600, fontSize: 13,
          }}>
            Kanal loeschen
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px',
  background: 'var(--bg-secondary, #080b0f)',
  border: '1px solid var(--color-border, #1e2733)',
  borderRadius: 4, color: 'var(--text-primary, #dde4ef)',
  fontSize: 14, outline: 'none',
};
