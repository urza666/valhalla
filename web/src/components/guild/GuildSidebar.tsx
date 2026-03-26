import type { Guild } from '../../api/client';

interface Props {
  guilds: Guild[];
  selectedGuildId: string | null;
  onSelectGuild: (id: string) => void;
  onCreateGuild: () => void;
}

export function GuildSidebar({ guilds, selectedGuildId, onSelectGuild, onCreateGuild }: Props) {
  return (
    <div className="guild-sidebar">
      {guilds.map((guild) => (
        <div
          key={guild.id}
          className={`guild-icon ${guild.id === selectedGuildId ? 'active' : ''}`}
          onClick={() => onSelectGuild(guild.id)}
          title={guild.name}
        >
          {guild.icon ? (
            <img src={`/api/v1/assets/icons/${guild.id}/${guild.icon}`} alt="" width={48} height={48} />
          ) : (
            getInitials(guild.name)
          )}
        </div>
      ))}

      <div className="guild-icon add" onClick={onCreateGuild} title="Create Server">
        +
      </div>
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
