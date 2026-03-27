/**
 * ScreenShareViewer — LPP-identical fullscreen screen share viewer.
 * Zoom modes, PiP, fullscreen toggle.
 */
import { useEffect, useRef, useState, useCallback } from 'react';

interface Props {
  videoTrack: any; // LiveKit RemoteVideoTrack
  sharerName: string;
  onClose: () => void;
}

type ZoomMode = 'fit' | '100' | 'actual';

export function ScreenShareViewer({ videoTrack, sharerName, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<ZoomMode>('fit');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (videoTrack && videoRef.current) {
      videoTrack.attach(videoRef.current);
    }
    return () => {
      if (videoTrack && videoRef.current) {
        videoTrack.detach(videoRef.current);
      }
    };
  }, [videoTrack]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const togglePiP = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await videoRef.current.requestPictureInPicture();
    } catch { /* not supported */ }
  }, []);

  const cycleZoom = () => setZoom((z) => z === 'fit' ? '100' : z === '100' ? 'actual' : 'fit');

  const videoStyle: React.CSSProperties = zoom === 'fit'
    ? { width: '100%', height: '100%', objectFit: 'contain' }
    : zoom === '100'
      ? { width: '100%', height: '100%', objectFit: 'cover' }
      : { maxWidth: 'none', maxHeight: 'none' };

  return (
    <div ref={containerRef} style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.95)', display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', background: 'rgba(0,0,0,0.7)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontSize: 14, fontWeight: 600 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3ba55d" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" /><polyline points="8 21 16 21" /><line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          {sharerName} teilt den Bildschirm
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <CtrlBtn onClick={cycleZoom} title={`Zoom: ${zoom}`}>🔍</CtrlBtn>
          <CtrlBtn onClick={togglePiP} title="Bild-in-Bild">📺</CtrlBtn>
          <CtrlBtn onClick={toggleFullscreen} title={isFullscreen ? 'Vollbild beenden' : 'Vollbild'}>⛶</CtrlBtn>
          <CtrlBtn onClick={onClose} title="Schliessen" danger>✕</CtrlBtn>
        </div>
      </div>

      {/* Video */}
      <div style={{ flex: 1, overflow: zoom === 'actual' ? 'auto' : 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <video ref={videoRef} autoPlay playsInline style={videoStyle} />
      </div>

      {/* Zoom indicator */}
      <div style={{
        position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.7)', color: '#fff', padding: '4px 12px', borderRadius: 12, fontSize: 12,
      }}>
        {zoom === 'fit' ? 'Einpassen' : zoom === '100' ? '100%' : 'Original'}
      </div>
    </div>
  );
}

function CtrlBtn({ onClick, title, danger, children }: {
  onClick: () => void; title: string; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} title={title} style={{
      background: danger ? 'rgba(237,66,69,0.3)' : 'rgba(255,255,255,0.1)',
      border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer',
      color: danger ? '#ed4245' : '#fff', fontSize: 14,
      transition: 'background 0.15s',
    }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = danger ? 'rgba(237,66,69,0.5)' : 'rgba(255,255,255,0.2)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = danger ? 'rgba(237,66,69,0.3)' : 'rgba(255,255,255,0.1)'; }}
    >
      {children}
    </button>
  );
}
