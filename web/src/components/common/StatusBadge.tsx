type StatusType =
  | 'online' | 'idle' | 'dnd' | 'offline'
  | 'success' | 'warning' | 'error' | 'info'
  | 'active' | 'inactive' | 'pending' | 'draft'
  | 'published' | 'archived' | 'completed' | 'cancelled'
  | 'open' | 'closed' | 'locked' | 'muted'
  | 'connected' | 'disconnected' | 'speaking';

interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
  size?: 'sm' | 'md';
  dot?: boolean;
}

const statusColors: Record<string, string> = {
  online: 'var(--status-online)',
  idle: 'var(--status-idle)',
  dnd: 'var(--status-dnd)',
  offline: 'var(--text-muted)',
  success: 'var(--success)',
  warning: 'var(--color-warning)',
  error: 'var(--danger)',
  info: 'var(--color-info)',
  active: 'var(--status-online)',
  inactive: 'var(--text-muted)',
  pending: 'var(--color-warning)',
  draft: 'var(--text-muted)',
  published: 'var(--status-online)',
  archived: 'var(--text-muted)',
  completed: 'var(--status-online)',
  cancelled: 'var(--danger)',
  open: 'var(--color-info)',
  closed: 'var(--text-muted)',
  locked: 'var(--color-warning)',
  muted: 'var(--text-muted)',
  connected: 'var(--color-voice-accent)',
  disconnected: 'var(--text-muted)',
  speaking: 'var(--color-voice-online)',
};

export function StatusBadge({ status, label, size = 'md', dot = true }: StatusBadgeProps) {
  const color = statusColors[status] || statusColors.offline;
  const isSm = size === 'sm';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSm ? 4 : 6,
        padding: isSm ? '1px 6px' : '2px 8px',
        borderRadius: 'var(--radius-md)',
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        color,
        fontSize: isSm ? 11 : 12,
        fontWeight: 500,
        lineHeight: 1.4,
      }}
    >
      {dot && (
        <span
          style={{
            width: isSm ? 5 : 6,
            height: isSm ? 5 : 6,
            borderRadius: '50%',
            background: color,
            flexShrink: 0,
          }}
        />
      )}
      {label || status}
    </span>
  );
}
