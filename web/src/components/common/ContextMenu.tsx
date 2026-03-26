import { useEffect, useRef, useState } from 'react';

export interface MenuItem {
  label?: string;
  icon?: string;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
  onClick?: () => void;
}

interface Props {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  // Keep menu within viewport
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - items.length * 36 - 16);

  return (
    <div className="ctx-backdrop">
      <div
        ref={ref}
        className="ctx-menu"
        style={{ left: adjustedX, top: adjustedY }}
      >
        {items.map((item, i) =>
          item.separator ? (
            <div key={i} className="ctx-separator" />
          ) : (
            <button
              key={i}
              className={`ctx-item ${item.danger ? 'danger' : ''} ${item.disabled ? 'disabled' : ''}`}
              onClick={() => {
                if (!item.disabled && item.onClick) {
                  item.onClick();
                  onClose();
                }
              }}
              disabled={item.disabled}
            >
              {item.icon && <span className="ctx-icon">{item.icon}</span>}
              {item.label}
            </button>
          )
        )}
      </div>
    </div>
  );
}

// Hook for context menu state
export function useContextMenu() {
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);

  const show = (e: React.MouseEvent, items: MenuItem[]) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, items });
  };

  const close = () => setMenu(null);

  return { menu, show, close };
}

