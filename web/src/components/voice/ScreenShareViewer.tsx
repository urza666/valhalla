/**
 * ScreenShareViewer — Full-screen overlay for viewing shared screens.
 * Ported from LPP with zoom/PiP/fullscreen support.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import type { RemoteTrackPublication, RemoteVideoTrack } from 'livekit-client';

interface Props {
  track: RemoteTrackPublication;
  sharerName: string;
  onClose: () => void;
}

type ZoomMode = 'fit' | '100' | 'actual';

export function ScreenShareViewer({ track, sharerName, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<ZoomMode>('fit');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Attach track
  useEffect(() => {
    const videoTrack = track.track as RemoteVideoTrack | undefined;
    if (videoTrack && videoRef.current) {
      videoTrack.attach(videoRef.current);
    }
    return () => {
      if (videoTrack && videoRef.current) {
        videoTrack.detach(videoRef.current);
      }
    };
  }, [track]);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
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
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch { /* PiP not supported */ }
  }, []);

  const cycleZoom = () => {
    setZoom((z) => z === 'fit' ? '100' : z === '100' ? 'actual' : 'fit');
  };

  const videoStyle: React.CSSProperties = zoom === 'fit'
    ? { width: '100%', height: '100%', objectFit: 'contain' }
    : zoom === '100'
      ? { width: '100%', height: '100%', objectFit: 'cover' }
      : { maxWidth: 'none', maxHeight: 'none' };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        background: 'rgba(0,0,0,0.95)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        background: 'rgba(0,0,0,0.7)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-voice-online)" strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <polyline points="8 21 16 21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
            {sharerName} teilt den Bildschirm
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <ControlBtn onClick={cycleZoom} title={`Zoom: ${zoom}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </ControlBtn>
          <ControlBtn onClick={togglePiP} title="Bild-in-Bild">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="2" width="20" height="20" rx="2" />
              <rect x="10" y="10" width="10" height="10" rx="1" fill="currentColor" opacity="0.3" />
            </svg>
          </ControlBtn>
          <ControlBtn onClick={toggleFullscreen} title={isFullscreen ? 'Vollbild beenden' : 'Vollbild'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </ControlBtn>
          <ControlBtn onClick={onClose} title="Schliessen" danger>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </ControlBtn>
        </div>
      </div>

      {/* Video */}
      <div style={{ flex: 1, overflow: zoom === 'actual' ? 'auto' : 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={videoStyle}
        />
      </div>

      {/* Zoom indicator */}
      <div style={{
        position: 'absolute',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.7)',
        color: '#fff',
        padding: '4px 12px',
        borderRadius: 12,
        fontSize: 12,
      }}>
        {zoom === 'fit' ? 'Einpassen' : zoom === '100' ? '100%' : 'Originalgroesse'}
      </div>
    </div>
  );
}

function ControlBtn({ onClick, title, danger, children }: {
  onClick: () => void; title: string; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: danger ? 'rgba(237,66,69,0.3)' : 'rgba(255,255,255,0.1)',
        border: 'none',
        borderRadius: 6,
        padding: '6px 10px',
        cursor: 'pointer',
        color: danger ? '#ed4245' : '#fff',
        display: 'flex',
        alignItems: 'center',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = danger ? 'rgba(237,66,69,0.5)' : 'rgba(255,255,255,0.2)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = danger ? 'rgba(237,66,69,0.3)' : 'rgba(255,255,255,0.1)'; }}
    >
      {children}
    </button>
  );
}
