/**
 * VoiceSettingsPanel — LPP-identical device selection + mic test.
 */
import { useState, useEffect, useRef } from 'react';
import { useVoiceStore } from '../../stores/voice';
import { Modal } from '../../components/ui/Modal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function VoiceSettingsPanel({ isOpen, onClose }: Props) {
  const {
    audioInputDevice, audioOutputDevice, videoInputDevice,
    setAudioInputDevice, setAudioOutputDevice, setVideoInputDevice,
    inputVolume, outputVolume, setInputVolume, setOutputVolume,
  } = useVoiceStore();

  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [micTestActive, setMicTestActive] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() =>
          navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null)
        );
        stream?.getTracks().forEach((t) => t.stop());
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devices.filter((d) => d.kind === 'audioinput'));
        setAudioOutputs(devices.filter((d) => d.kind === 'audiooutput'));
        setVideoInputs(devices.filter((d) => d.kind === 'videoinput'));
      } catch { /* permission denied */ }
    })();
  }, [isOpen]);

  useEffect(() => {
    if (!micTestActive) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setMicLevel(0);
      return;
    }
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: audioInputDevice ? { deviceId: { exact: audioInputDevice } } : true,
        });
        streamRef.current = stream;
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          setMicLevel(Math.min(avg / 128, 1));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch { setMicTestActive(false); }
    })();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [micTestActive, audioInputDevice]);

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px',
    background: 'var(--bg-secondary, #080b0f)', color: 'var(--text-primary, #dde4ef)',
    border: '1px solid var(--color-border, #1e2733)', borderRadius: 4, fontSize: 14, outline: 'none',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sprach- & Videoeinstellungen" size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Mikrofon */}
        <Section title="Mikrofon">
          <select value={audioInputDevice} onChange={(e) => setAudioInputDevice(e.target.value)} style={selectStyle}>
            <option value="">Standard</option>
            {audioInputs.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Mikrofon ${d.deviceId.slice(0, 8)}`}</option>)}
          </select>
          <RangeRow label="Lautstaerke" value={inputVolume} onChange={setInputVolume} />
          <button
            onClick={() => setMicTestActive(!micTestActive)}
            style={{
              marginTop: 8, padding: '6px 12px', fontSize: 13, borderRadius: 4, border: 'none', cursor: 'pointer',
              background: micTestActive ? 'rgba(237,66,69,0.2)' : 'rgba(200,168,74,0.1)',
              color: micTestActive ? '#ed4245' : 'var(--brand-primary, #c8a84a)',
              fontWeight: 600,
            }}
          >
            {micTestActive ? 'Test beenden' : 'Mikrofon testen'}
          </button>
          {micTestActive && (
            <div style={{ marginTop: 8, height: 8, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${micLevel * 100}%`, borderRadius: 4, transition: 'width 50ms',
                background: micLevel > 0.6 ? '#ed4245' : '#3ba55d',
              }} />
            </div>
          )}
        </Section>

        {/* Lautsprecher */}
        <Section title="Lautsprecher">
          <select value={audioOutputDevice} onChange={(e) => setAudioOutputDevice(e.target.value)} style={selectStyle}>
            <option value="">Standard</option>
            {audioOutputs.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Lautsprecher ${d.deviceId.slice(0, 8)}`}</option>)}
          </select>
          <RangeRow label="Lautstaerke" value={outputVolume} onChange={setOutputVolume} />
        </Section>

        {/* Kamera */}
        <Section title="Kamera">
          <select value={videoInputDevice} onChange={(e) => setVideoInputDevice(e.target.value)} style={selectStyle}>
            <option value="">Standard</option>
            {videoInputs.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Kamera ${d.deviceId.slice(0, 8)}`}</option>)}
          </select>
        </Section>
      </div>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>
        {title}
      </h4>
      {children}
    </div>
  );
}

function RangeRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)', minWidth: 80 }}>{label}</span>
      <input type="range" min="0" max="100" value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ flex: 1 }} />
      <span style={{ fontSize: 13, color: 'var(--text-muted)', minWidth: 36, textAlign: 'right' }}>{value}%</span>
    </div>
  );
}
