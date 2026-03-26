interface StatusBadgeProps {
  status: 'online' | 'idle' | 'dnd' | 'offline' | 'success' | 'warning' | 'error' | 'info';
  label?: string;
}

const statusColors: Record<string, string> = {
  online: 'var(--status-online)',
  idle: 'var(--status-idle)',
  dnd: 'var(--status-dnd)',
  offline: 'var(--text-muted)',
  success: 'var(--success)',
  warning: 'var(--color-warning, var(--status-idle))',
  error: 'var(--danger)',
  info: 'var(--color-info, var(--text-link))',
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const color = statusColors[status] || statusColors.offline;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        borderRadius: 'var(--radius-md)',
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        color,
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      {label || status}
    </span>
  );
}
