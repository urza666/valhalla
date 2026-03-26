import { useState } from 'react';
import { useAppStore } from '../../stores/app';
import { useVoiceStore } from '../../stores/voice';
import { UserSettings } from '../admin/UserSettings';
import { ContextMenu, useContextMenu } from '../common/ContextMenu';
import { VoiceConnectedBar } from '../voice/VoiceConnectedBar';
import { VoiceChannel } from '../voice/VoiceChannel';
import { ServerSettings } from '../admin/ServerSettings';
import { InviteDialog } from '../admin/InviteDialog';
import type { Guild, User, Channel } from '../../api/client';

interface Props {
  guild: Guild;
  user: User;
}

export function ChannelSidebar({ guild, user }: Props) {
  const { channels, selectedChannelId, selectChannel, loadGuilds } = useAppStore();
  const guildChannels = channels.get(guild.id) || [];
  const [showSettings, setShowSettings] = useState(false);
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [inviteChannelId, setInviteChannelId] = useState<string | null>(null);
  const channelCtx = useContextMenu();

  const categories = guildChannels.filter((c) => c.type === 4);
  const uncategorized = guildChannels.filter((c) => c.type !== 4 && !c.parent_id);

  const isOwner = guild.owner_id === user.id;

  const getChannelContextItems = (ch: Channel) => [
    { label: 'Einladung erstellen', icon: '🔗', onClick: () => setInviteChannelId(ch.id) },
    ...(isOwner ? [
      { separator: true },
      { label: 'Kanal bearbeiten', icon: '⚙️', onClick: () => setShowSettings(true) },
      { label: 'Kanal loschen', icon: '🗑️', danger: true, onClick: async () => {
        if (confirm(`Kanal "${ch.name}" wirklich loschen?`)) {
          await fetch(`/api/v1/channels/${ch.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          });
          loadGuilds();
        }
      }},
    ] : []),
  ];

  return (
    <div className="channel-sidebar">
      {/* Server header with dropdown */}
      <div
        className="channel-sidebar-header"
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        onClick={() => setShowSettings(true)}
      >
        <span>{guild.name}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>⚙</span>
      </div>

      <div className="channel-list">
        {uncategorized.map((ch) => (
          <ChannelItem
            key={ch.id}
            channel={ch}
            guildId={guild.id}
            active={ch.id === selectedChannelId}
            onClick={() => selectChannel(ch.id)}
            onContextMenu={(e) => channelCtx.show(e, getChannelContextItems(ch))}
          />
        ))}

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
                  onContextMenu={(e) => channelCtx.show(e, getChannelContextItems(ch))}
                />
              ))}
            </div>
          );
        })}
      </div>

      <VoiceConnectedBar />

      <div className="user-panel">
        <div className="user-panel-avatar">{user.username[0].toUpperCase()}</div>
        <div className="user-panel-info" onClick={() => setShowUserSettings(true)} style={{ cursor: 'pointer' }}>
          <div className="user-panel-name">{user.display_name || user.username}</div>
          <div className="user-panel-status">Online</div>
        </div>
        <button
          onClick={() => setShowUserSettings(true)}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px' }}
          title="Einstellungen"
        >
          ⚙
        </button>
      </div>

      {/* Context menu */}
      {channelCtx.menu && (
        <ContextMenu x={channelCtx.menu.x} y={channelCtx.menu.y} items={channelCtx.menu.items} onClose={channelCtx.close} />
      )}

      {/* Server settings modal */}
      {showSettings && (
        <ServerSettings
          guild={guild}
          onClose={() => setShowSettings(false)}
          onUpdate={() => { loadGuilds(); setShowSettings(false); }}
          onDelete={async () => {
            if (confirm(`Server "${guild.name}" wirklich loschen? Das kann nicht ruckgangig gemacht werden!`)) {
              await fetch(`/api/v1/guilds/${guild.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
              });
              loadGuilds();
              setShowSettings(false);
            }
          }}
        />
      )}

      {/* Invite dialog */}
      {inviteChannelId && (
        <InviteDialog channelId={inviteChannelId} onClose={() => setInviteChannelId(null)} />
      )}

      {/* User settings */}
      {showUserSettings && (
        <UserSettings onClose={() => setShowUserSettings(false)} />
      )}
    </div>
  );
}

function ChannelItem({ channel, active, onClick, guildId, onContextMenu }: {
  channel: Channel; active: boolean; onClick: () => void; guildId: string;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
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
        onContextMenu={onContextMenu}
      >
        <span className="hash">{icon}</span>
        {channel.name}
      </div>
      {isVoice && <VoiceChannel channelId={channel.id} guildId={guildId} />}
    </>
  );
}
