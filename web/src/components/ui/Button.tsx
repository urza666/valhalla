/**
 * Button — LPP-identical button component.
 * Variants: primary (gold gradient), secondary (border), danger (red gradient), ghost.
 * Sizes: sm, md, lg.
 */
import { type ButtonHTMLAttributes, type ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children?: ReactNode;
}

const variantStyles: Record<string, React.CSSProperties> = {
  primary: {
    background: 'linear-gradient(135deg, #c8a84a, #8a6e28)',
    color: '#080b0f',
    border: 'none',
    fontWeight: 700,
    letterSpacing: '0.03em',
  },
  secondary: {
    background: 'transparent',
    color: 'var(--text-secondary, #9ba8b8)',
    border: '1px solid var(--color-border, #1e2733)',
  },
  danger: {
    background: 'linear-gradient(135deg, var(--danger, #e85454), #dc2626)',
    color: '#fff',
    border: 'none',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary, #9ba8b8)',
    border: 'none',
  },
};

const sizeStyles: Record<string, React.CSSProperties> = {
  sm: { padding: '6px 12px', fontSize: 12 },
  md: { padding: '8px 16px', fontSize: 14 },
  lg: { padding: '12px 24px', fontSize: 16 },
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: 'var(--radius-md, 4px)',
        fontWeight: 600,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.5 : 1,
        transition: 'all 0.2s ease',
        outline: 'none',
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      onMouseEnter={(e) => {
        if (isDisabled) return;
        const el = e.currentTarget;
        if (variant === 'primary') {
          el.style.background = 'linear-gradient(135deg, #e8cc7a, #c8a84a)';
          el.style.boxShadow = '0 0 24px rgba(200, 168, 74, 0.25)';
          el.style.transform = 'scale(1.02)';
        } else if (variant === 'secondary') {
          el.style.background = 'rgba(200, 168, 74, 0.06)';
          el.style.borderColor = '#c8a84a';
          el.style.color = '#e8cc7a';
        } else if (variant === 'danger') {
          el.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.3)';
          el.style.transform = 'scale(1.02)';
        } else if (variant === 'ghost') {
          el.style.background = 'rgba(200, 168, 74, 0.06)';
          el.style.color = 'var(--text-primary, #dde4ef)';
        }
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        Object.assign(el.style, variantStyles[variant]);
        el.style.boxShadow = '';
        el.style.transform = '';
      }}
      {...props}
    >
      {loading && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" opacity="0.3" />
          <path fill="currentColor" opacity="0.75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
