import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ animation: 'fadeIn 0.15s ease' }}
    >
      <div
        className="modal-content card-elevated"
        style={{
          animation: 'slideUp 0.15s ease',
          maxWidth: 480,
          width: '90vw',
          maxHeight: '90vh',
          overflow: 'auto',
          padding: 'var(--space-xl)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {title && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h2>
            <button
              onClick={onClose}
              className="btn-secondary"
              style={{ padding: '4px 8px', fontSize: 16, lineHeight: 1 }}
              aria-label="Schließen"
            >
              ✕
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
