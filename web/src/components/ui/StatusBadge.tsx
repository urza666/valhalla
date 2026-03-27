/**
 * StatusBadge — LPP-identical status indicator with dot + label.
 */

const statusConfig: Record<string, { label: string; color: string }> = {
  // Online/Presence
  online: { label: 'Online', color: '#3ba55d' },
  idle: { label: 'Abwesend', color: '#faa81a' },
  dnd: { label: 'Nicht stoeren', color: '#ed4245' },
  offline: { label: 'Offline', color: '#747f8d' },
  // Generic
  active: { label: 'Aktiv', color: '#10b981' },
  inactive: { label: 'Inaktiv', color: '#3b82f6' },
  pending: { label: 'Ausstehend', color: '#f59e0b' },
  draft: { label: 'Entwurf', color: '#3b82f6' },
  published: { label: 'Veroeffentlicht', color: '#3b82f6' },
  completed: { label: 'Abgeschlossen', color: '#3b82f6' },
  cancelled: { label: 'Abgesagt', color: '#ef4444' },
  // Voice
  connected: { label: 'Verbunden', color: '#5865f2' },
  speaking: { label: 'Spricht', color: '#3ba55d' },
  muted: { label: 'Stumm', color: '#747f8d' },
  // Operations
  running: { label: 'Laeuft', color: '#10b981' },
  stopped: { label: 'Gestoppt', color: '#3b82f6' },
  failed: { label: 'Fehlgeschlagen', color: '#ef4444' },
  // Moderation
  open: { label: 'Offen', color: '#3b82f6' },
  resolved: { label: 'Geloest', color: '#10b981' },
  dismissed: { label: 'Abgewiesen', color: '#3b82f6' },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, color: '#3b82f6' };

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        borderRadius: 9999,
        padding: '2px 10px 2px 8px',
        fontSize: 12,
        fontWeight: 500,
        background: `${config.color}22`,
        color: config.color,
      }}
    >
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: config.color, flexShrink: 0,
      }} />
      {config.label}
    </span>
  );
}
