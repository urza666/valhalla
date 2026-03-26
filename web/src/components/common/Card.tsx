import { type HTMLAttributes, type ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  children: ReactNode;
}

export function Card({ elevated = false, children, className = '', ...props }: CardProps) {
  const baseClass = elevated ? 'card-elevated' : 'card';
  return (
    <div className={`${baseClass} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
