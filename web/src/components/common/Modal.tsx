import { useEffect, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  size?: ModalSize;
  children: ReactNode;
  footer?: ReactNode;
}

const maxWidths: Record<ModalSize, number> = {
  sm: 380,
  md: 480,
  lg: 640,
  xl: 900,
};

export function Modal({ open, onClose, title, size = 'md', children, footer }: ModalProps) {
  const handleEsc = useCallback(
    (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleEsc);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [open, handleEsc]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ animation: 'fadeIn 0.15s ease' }}
    >
      <div
        className="modal-content card-elevated"
        style={{
          animation: 'slideUp 0.15s ease',
          maxWidth: maxWidths[size],
          width: '90vw',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {title && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 'var(--space-lg) var(--space-xl)',
              borderBottom: '1px solid var(--color-border)',
              flexShrink: 0,
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h2>
            <button
              onClick={onClose}
              className="btn-ghost"
              style={{ padding: '4px 8px', fontSize: 16, lineHeight: 1 }}
              aria-label="Close"
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div style={{ padding: 'var(--space-xl)', overflow: 'auto', flex: 1 }}>
          {children}
        </div>
        {footer && (
          <div
            style={{
              padding: 'var(--space-md) var(--space-xl)',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 'var(--space-sm)',
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
