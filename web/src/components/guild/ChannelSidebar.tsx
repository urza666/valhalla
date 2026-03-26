import { useAppStore } from '../../stores/app';
import { useVoiceStore } from '../../stores/voice';
import { VoiceConnectedBar } from '../voice/VoiceConnectedBar';
import { VoiceChannel } from '../voice/VoiceChannel';
import type { Guild, User, Channel } from '../../api/client';

interface Props {
  guild: Guild;
  user: User;
  onLogout: () => void;
}

export function ChannelSidebar({ guild, user, onLogout }: Props) {
  const { channels, selectedChannelId, selectChannel } = useAppStore();
  const guildChannels = channels.get(guild.id) || [];

  // Group channels by category
  const categories = guildChannels.filter((c) => c.type === 4);
  const uncategorized = guildChannels.filter((c) => c.type !== 4 && !c.parent_id);

  return (
    <div className="channel-sidebar">
      <div className="channel-sidebar-header">
        {guild.name}
      </div>

      <div className="channel-list">
        {/* Uncategorized channels */}
        {uncategorized.map((ch) => (
          <ChannelItem
            key={ch.id}
            channel={ch}
            guildId={guild.id}
            active={ch.id === selectedChannelId}
            onClick={() => selectChannel(ch.id)}
          />
        ))}

        {/* Categorized channels */}
        {categories.map((cat) => {
          const children = guildChannels.filter((c) => c.parent_id === cat.id);
          return (
            <div key={cat.id}>
              <div className="channel-category">{cat.name}</div>
              {children.map((ch) => (
                <ChannelItem
                  key={ch.id}
                  channel={ch}
                  guildId={guild.id}
                  active={ch.id === selectedChannelId}
                  onClick={() => selectChannel(ch.id)}
                />
              ))}
            </div>
          );
        })}
      </div>

      {/* Voice connected bar */}
      <VoiceConnectedBar />

      {/* User panel */}
      <div className="user-panel">
        <div className="user-panel-avatar">
          {user.username[0].toUpperCase()}
        </div>
        <div className="user-panel-info">
          <div className="user-panel-name">{user.display_name || user.username}</div>
          <div className="user-panel-status">Online</div>
        </div>
        <button
          onClick={onLogout}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px' }}
          title="Logout"
        >
          ⏻
        </button>
      </div>
    </div>
  );
}

function ChannelItem({ channel, active, onClick, guildId }: { channel: Channel; active: boolean; onClick: () => void; guildId: string }) {
  const { joinChannel, channelId: voiceChannelId } = useVoiceStore();
  const isVoice = channel.type === 2;
  const icon = isVoice ? '🔊' : '#';
  const isVoiceActive = isVoice && voiceChannelId === channel.id;

  const handleClick = () => {
    if (isVoice) {
      joinChannel(guildId, channel.id);
    } else {
      onClick();
    }
  };

  return (
    <>
      <div
        className={`channel-item ${active && !isVoice ? 'active' : ''} ${isVoiceActive ? 'active' : ''}`}
        onClick={handleClick}
      >
        <span className="hash">{icon}</span>
        {channel.name}
      </div>
      {isVoice && (
        <VoiceChannel channelId={channel.id} guildId={guildId} />
      )}
    </>
  );
}
