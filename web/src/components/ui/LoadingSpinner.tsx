/**
 * LoadingSpinner — LPP-identical animated spinner.
 */
const sizes = { sm: 16, md: 32, lg: 48 };

export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = sizes[size];
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: size === 'sm' ? 4 : 32 }}>
      <svg
        width={s} height={s} viewBox="0 0 24 24" fill="none"
        style={{ animation: 'spin 1s linear infinite', color: 'var(--brand-primary, #c8a84a)' }}
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" opacity="0.25" />
        <path fill="currentColor" opacity="0.75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}
