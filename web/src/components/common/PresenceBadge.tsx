interface Props {
  status: 'online' | 'idle' | 'dnd' | 'offline';
  size?: number;
}

const statusColors: Record<string, string> = {
  online: 'var(--status-online)',
  idle: 'var(--status-idle)',
  dnd: 'var(--status-dnd)',
  offline: 'var(--text-muted)',
};

export function PresenceBadge({ status, size = 10 }: Props) {
  const color = statusColors[status] || statusColors.offline;

  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        border: `2px solid var(--bg-secondary)`,
        flexShrink: 0,
      }}
      title={status.charAt(0).toUpperCase() + status.slice(1)}
    />
  );
}
