import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
  children?: ReactNode;
}

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'btn-xs',
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  fullWidth = false,
  children,
  className,
  disabled,
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        variant === 'ghost' ? 'btn-ghost' : `btn-${variant}`,
        sizeClasses[size],
        fullWidth && 'btn-full',
        (disabled || loading) && 'btn-disabled',
        className,
      )}
      disabled={disabled || loading}
      style={style}
      {...props}
    >
      {loading ? (
        <LoadingDots />
      ) : (
        <>
          {icon && <span className="btn-icon">{icon}</span>}
          {children}
          {iconRight && <span className="btn-icon-right">{iconRight}</span>}
        </>
      )}
    </button>
  );
}

function LoadingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'currentColor',
            animation: `typingDot 1.4s infinite ${i * 0.2}s`,
          }}
        />
      ))}
    </span>
  );
}
