import { type HTMLAttributes, type ReactNode } from 'react';
import clsx from 'clsx';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  hover?: boolean;
  children: ReactNode;
}

export function Card({ elevated = false, hover = false, children, className, style, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        elevated ? 'card-elevated' : 'card',
        hover && 'hover-lift',
        className,
      )}
      style={{ borderRadius: 'var(--radius-lg)', ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx('card-header', className)}
      style={{ marginBottom: 'var(--space-lg)', paddingBottom: 'var(--space-md)', borderBottom: '1px solid var(--color-border)' }}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={clsx(className)}
      style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}
      {...props}
    >
      {children}
    </h3>
  );
}
