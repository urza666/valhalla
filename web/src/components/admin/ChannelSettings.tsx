import { useState } from 'react';
import { api, Channel } from '../../api/client';
import { toast } from '../../stores/toast';

interface Props {
  channel: Channel;
  onClose: () => void;
  onUpdate: () => void;
}

export function ChannelSettings({ channel, onClose, onUpdate }: Props) {
  const isVoice = channel.type === 2;
  const [name, setName] = useState(channel.name || '');
  const [topic, setTopic] = useState(channel.topic || '');
  const [bitrate, setBitrate] = useState(channel.bitrate || 64000);
  const [userLimit, setUserLimit] = useState(channel.user_limit || 0);
  const [slowmode, setSlowmode] = useState(channel.rate_limit_per_user || 0);
  const [nsfw, setNsfw] = useState(channel.nsfw || false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.updateChannel(channel.id, {
        name: name !== channel.name ? name : undefined,
        topic: topic !== (channel.topic || '') ? topic : undefined,
        bitrate: isVoice ? bitrate : undefined,
        user_limit: isVoice ? userLimit : undefined,
        rate_limit_per_user: !isVoice ? slowmode : undefined,
        nsfw,
      });
      toast.success('Kanal aktualisiert');
      onUpdate();
    } catch {
      toast.error('Aktualisierung fehlgeschlagen');
    }
    setSaving(false);
  };

  const slowmodeLabels: Record<number, string> = {
    0: 'Aus', 5: '5s', 10: '10s', 15: '15s', 30: '30s',
    60: '1m', 120: '2m', 300: '5m', 600: '10m', 900: '15m',
    1800: '30m', 3600: '1h', 7200: '2h', 21600: '6h',
  };

  const bitrateKbps = Math.round(bitrate / 1000);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="settings-content" style={{ padding: 24 }}>
          <button className="settings-close" onClick={onClose}>ESC</button>

          <h2 style={{ marginBottom: 20 }}>
            {isVoice ? '🔊' : '#'} Kanal bearbeiten
          </h2>

          {/* Name */}
          <div className="form-group">
            <label>Kanalname</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/g, ''))}
              maxLength={100}
            />
          </div>

          {/* Topic */}
          <div className="form-group">
            <label>Thema / Beschreibung</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Worum geht es in diesem Kanal?"
              maxLength={1024}
              rows={2}
              style={{ width: '100%', padding: '10px 12px', border: 'none', borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'var(--font-primary)', resize: 'vertical' }}
            />
          </div>

          {/* Voice-specific settings */}
          {isVoice && (
            <>
              <div className="settings-tab-sep" style={{ margin: '20px 0' }} />
              <h3 style={{ fontSize: 15, marginBottom: 12 }}>Voice-Einstellungen</h3>

              {/* Bitrate */}
              <div className="form-group">
                <label>Bitrate: {bitrateKbps} kbps</label>
                <input
                  type="range"
                  min={8000}
                  max={384000}
                  step={1000}
                  value={bitrate}
                  onChange={(e) => setBitrate(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>8 kbps</span>
                  <span>96 kbps</span>
                  <span>384 kbps</span>
                </div>
              </div>

              {/* User Limit */}
              <div className="form-group">
                <label>Benutzerlimit: {userLimit === 0 ? 'Unbegrenzt' : userLimit}</label>
                <input
                  type="range"
                  min={0}
                  max={99}
                  value={userLimit}
                  onChange={(e) => setUserLimit(Number(e.target.value))}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>Kein Limit</span>
                  <span>99</span>
                </div>
              </div>
            </>
          )}

          {/* Text-specific settings */}
          {!isVoice && (
            <>
              <div className="settings-tab-sep" style={{ margin: '20px 0' }} />
              <h3 style={{ fontSize: 15, marginBottom: 12 }}>Text-Einstellungen</h3>

              {/* Slowmode */}
              <div className="form-group">
                <label>Slowmode: {slowmodeLabels[slowmode] || `${slowmode}s`}</label>
                <select
                  value={slowmode}
                  onChange={(e) => setSlowmode(Number(e.target.value))}
                  style={{ width: '100%', padding: '10px 12px', border: 'none', borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: 14 }}
                >
                  {Object.entries(slowmodeLabels).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              {/* NSFW */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)' }}>
                <input type="checkbox" checked={nsfw} onChange={(e) => setNsfw(e.target.checked)} />
                Altersbeschränkter Kanal (NSFW)
              </label>
            </>
          )}

          <div className="settings-tab-sep" style={{ margin: '20px 0' }} />

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              className="btn"
              style={{ width: 'auto', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
              onClick={onClose}
            >
              Abbrechen
            </button>
            <button className="btn" style={{ width: 'auto' }} onClick={save} disabled={saving}>
              {saving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
