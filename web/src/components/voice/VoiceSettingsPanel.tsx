/**
 * VoiceSettingsPanel — Audio/Video device selection and settings.
 * Ported from LPP VoicePage VoiceSettingsPanel section.
 */
import { useState, useEffect, useRef } from 'react';
import { useVoiceStore } from '../../stores/voice';
import { Modal } from '../common/Modal';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function VoiceSettingsPanel({ open, onClose }: Props) {
  const {
    audioInputDevice: audioInputId,
    audioOutputDevice: audioOutputId,
    videoInputDevice: videoInputId,
    setAudioInputDevice: setAudioInput,
    setAudioOutputDevice: setAudioOutput,
    setVideoInputDevice: setVideoInput,
    inputVolume, outputVolume, setInputVolume, setOutputVolume,
  } = useVoiceStore();

  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [micTestActive, setMicTestActive] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  // Enumerate devices
  useEffect(() => {
    if (!open) return;
    const enumerate = async () => {
      try {
        // Request permission first
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() =>
          navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null)
        );
        stream?.getTracks().forEach((t) => t.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devices.filter((d) => d.kind === 'audioinput'));
        setAudioOutputs(devices.filter((d) => d.kind === 'audiooutput'));
        setVideoInputs(devices.filter((d) => d.kind === 'videoinput'));
      } catch { /* permission denied */ }
    };
    enumerate();
  }, [open]);

  // Mic test
  useEffect(() => {
    if (!micTestActive) {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setMicLevel(0);
      return;
    }

    const startTest = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: audioInputId ? { deviceId: { exact: audioInputId } } : true,
        });
        micStreamRef.current = stream;

        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const data = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(data);
          const avg = data.reduce((a, b) => a + b, 0) / data.length;
          setMicLevel(Math.min(avg / 128, 1));
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        setMicTestActive(false);
      }
    };
    startTest();

    return () => {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [micTestActive, audioInputId]);

  return (
    <Modal open={open} onClose={onClose} title="Sprach- & Videoeinstellungen" size="lg">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
        {/* Audio Input */}
        <Section title="Mikrofon">
          <select
            value={audioInputId}
            onChange={(e) => setAudioInput(e.target.value)}
            style={selectStyle}
          >
            <option value="">Standard</option>
            {audioInputs.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Mikrofon ${d.deviceId.slice(0, 8)}`}</option>
            ))}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <label style={labelStyle}>Lautstaerke</label>
            <input
              type="range" min="0" max="100" value={inputVolume}
              onChange={(e) => setInputVolume(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={valueStyle}>{inputVolume}%</span>
          </div>
          <button
            onClick={() => setMicTestActive(!micTestActive)}
            className={micTestActive ? 'btn-danger' : 'btn-secondary'}
            style={{ marginTop: 8, padding: '6px 12px', fontSize: 13 }}
          >
            {micTestActive ? 'Test beenden' : 'Mikrofon testen'}
          </button>
          {micTestActive && (
            <div style={{ marginTop: 8, height: 8, background: 'var(--bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${micLevel * 100}%`,
                background: micLevel > 0.6 ? 'var(--danger)' : 'var(--color-voice-online)',
                borderRadius: 4,
                transition: 'width 50ms',
              }} />
            </div>
          )}
        </Section>

        {/* Audio Output */}
        <Section title="Lautsprecher">
          <select
            value={audioOutputId}
            onChange={(e) => setAudioOutput(e.target.value)}
            style={selectStyle}
          >
            <option value="">Standard</option>
            {audioOutputs.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Lautsprecher ${d.deviceId.slice(0, 8)}`}</option>
            ))}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <label style={labelStyle}>Lautstaerke</label>
            <input
              type="range" min="0" max="100" value={outputVolume}
              onChange={(e) => setOutputVolume(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <span style={valueStyle}>{outputVolume}%</span>
          </div>
        </Section>

        {/* Video Input */}
        <Section title="Kamera">
          <select
            value={videoInputId}
            onChange={(e) => setVideoInput(e.target.value)}
            style={selectStyle}
          >
            <option value="">Standard</option>
            {videoInputs.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Kamera ${d.deviceId.slice(0, 8)}`}</option>
            ))}
          </select>
        </Section>
      </div>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>
        {title}
      </h4>
      {children}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-md)',
  fontSize: 14,
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-secondary)',
  minWidth: 80,
};

const valueStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-muted)',
  minWidth: 36,
  textAlign: 'right',
};
