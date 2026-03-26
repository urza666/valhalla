interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

const sizes = { sm: 16, md: 24, lg: 40 };

export function LoadingSpinner({ size = 'md' }: LoadingSpinnerProps) {
  const s = sizes[size];
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="var(--brand-primary)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="31.4 31.4"
        opacity="0.8"
      />
    </svg>
  );
}
