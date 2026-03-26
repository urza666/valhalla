import { useState } from 'react';
import { useAppStore } from '../../stores/app';
import { useVoiceStore } from '../../stores/voice';
import { UserSettings } from '../admin/UserSettings';
import { ContextMenu, useContextMenu } from '../common/ContextMenu';
import { VoiceConnectedBar } from '../voice/VoiceConnectedBar';
import { VoiceChannel } from '../voice/VoiceChannel';
import { ServerSettings } from '../admin/ServerSettings';
import { InviteDialog } from '../admin/InviteDialog';
import { ChannelSettings } from '../admin/ChannelSettings';
import { api } from '../../api/client';
import { toast } from '../../stores/toast';
import { useUnreadStore } from '../../stores/unread';
import type { Guild, User, Channel } from '../../api/client';

interface Props {
  guild: Guild;
  user: User;
  onChannelSelected?: () => void;
}

export function ChannelSidebar({ guild, user, onChannelSelected }: Props) {
  const { channels, selectedChannelId, selectChannel, loadGuilds } = useAppStore();
  const guildChannels = channels.get(guild.id) || [];
  const [showSettings, setShowSettings] = useState(false);
  const [showUserSettings, setShowUserSettings] = useState(false);
  const [inviteChannelId, setInviteChannelId] = useState<string | null>(null);
  const [editChannel, setEditChannel] = useState<Channel | null>(null);
  const channelCtx = useContextMenu();

  const categories = guildChannels.filter((c) => c.type === 4);
  const uncategorized = guildChannels.filter((c) => c.type !== 4 && !c.parent_id);

  const isOwner = guild.owner_id === user.id;

  const getChannelContextItems = (ch: Channel) => [
    { label: 'Einladung erstellen', icon: '🔗', onClick: () => setInviteChannelId(ch.id) },
    ...(isOwner ? [
      { separator: true },
      { label: 'Kanal bearbeiten', icon: '⚙️', onClick: () => setEditChannel(ch) },
      { label: 'Kanal löschen', icon: '🗑️', danger: true, onClick: async () => {
        if (confirm(`Kanal "${ch.name}" wirklich löschen?`)) {
          try {
            await api.deleteChannel(ch.id);
            loadGuilds();
          } catch {
            toast.error('Löschen fehlgeschlagen');
          }
        }
      }},
    ] : []),
  ];

  return (
    <aside className="channel-sidebar" aria-label="Kanäle">
      {/* Server header with dropdown */}
      <div
        className="channel-sidebar-header"
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        onClick={() => setShowSettings(true)}
      >
        <span>{guild.name}</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>⚙</span>
      </div>

      {/* Invite button for quick access */}
      <div style={{ padding: '4px 8px' }}>
        <button
          className="btn"
          style={{ width: '100%', fontSize: 12, padding: '6px 8px', background: 'var(--brand-primary)', color: '#fff' }}
          onClick={() => {
            const firstText = guildChannels.find(c => c.type === 0);
            if (firstText) setInviteChannelId(firstText.id);
          }}
        >
          Freunde einladen
        </button>
      </div>

      <div className="channel-list">
        {uncategorized.map((ch) => (
          <ChannelItem
            key={ch.id}
            channel={ch}
            guildId={guild.id}
            active={ch.id === selectedChannelId}
            onClick={() => { selectChannel(ch.id); onChannelSelected?.(); }}
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
                  onClick={() => { selectChannel(ch.id); onChannelSelected?.(); }}
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
          aria-label="Benutzer-Einstellungen öffnen"
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
            if (confirm(`Server "${guild.name}" wirklich löschen? Das kann nicht rückgängig gemacht werden!`)) {
              try {
                await api.deleteGuild(guild.id);
                loadGuilds();
                setShowSettings(false);
              } catch {
                toast.error('Löschen fehlgeschlagen');
              }
            }
          }}
        />
      )}

      {/* Invite dialog */}
      {inviteChannelId && (
        <InviteDialog channelId={inviteChannelId} onClose={() => setInviteChannelId(null)} />
      )}

      {/* Channel settings dialog */}
      {editChannel && (
        <ChannelSettings
          channel={editChannel}
          onClose={() => setEditChannel(null)}
          onUpdate={() => { loadGuilds(); setEditChannel(null); }}
        />
      )}

      {/* User settings */}
      {showUserSettings && (
        <UserSettings onClose={() => setShowUserSettings(false)} />
      )}
    </aside>
  );
}

function ChannelItem({ channel, active, onClick, guildId, onContextMenu }: {
  channel: Channel; active: boolean; onClick: () => void; guildId: string;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const { joinChannel, channelId: voiceChannelId } = useVoiceStore();
  const unreadCount = useUnreadStore((s) => s.unreadCounts.get(channel.id) || 0);
  const { markRead } = useUnreadStore();
  const isVoice = channel.type === 2;
  const icon = isVoice ? '🔊' : '#';
  const isVoiceActive = isVoice && voiceChannelId === channel.id;

  const handleClick = () => {
    if (isVoice) {
      joinChannel(guildId, channel.id);
    } else {
      onClick();
      // Mark as read when clicking
      if (unreadCount > 0) markRead(channel.id, '');
    }
  };

  return (
    <>
      <div
        className={`channel-item ${active && !isVoice ? 'active' : ''} ${isVoiceActive ? 'active' : ''} ${unreadCount > 0 ? 'unread' : ''}`}
        onClick={handleClick}
        onContextMenu={onContextMenu}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(); } }}
        aria-label={`${isVoice ? 'Sprachkanal' : 'Textkanal'}: ${channel.name}${unreadCount > 0 ? `, ${unreadCount} ungelesen` : ''}`}
        aria-current={active ? 'true' : undefined}
      >
        <span className="hash">{icon}</span>
        <span style={{ flex: 1 }}>{channel.name}</span>
        {unreadCount > 0 && (
          <span className="unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </div>
      {isVoice && <VoiceChannel channelId={channel.id} guildId={guildId} />}
    </>
  );
}
