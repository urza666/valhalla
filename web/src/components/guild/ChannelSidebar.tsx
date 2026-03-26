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
import { UserAvatar } from '../common/UserAvatar';
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
        <UserAvatar user={{ username: user.username, display_name: user.display_name, avatar: user.avatar }} size={32} showStatus status="online" />
        <div className="user-panel-info" onClick={() => setShowUserSettings(true)} style={{ cursor: 'pointer' }}>
          <div className="user-panel-name">{user.display_name || user.username}</div>
          <div className="user-panel-status">Online</div>
        </div>
        <div className="user-panel-buttons">
          <button
            className="user-panel-btn"
            onClick={() => useVoiceStore.getState().toggleMute()}
            title="Mikrofon stumm/ein"
          >
            {useVoiceStore.getState().selfMute
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/><path d="M17 16.95A7 7 0 015 12v-2m14 0v2c0 .5-.05.99-.16 1.46"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/></svg>
            }
          </button>
          <button
            className="user-panel-btn"
            onClick={() => useVoiceStore.getState().toggleDeaf()}
            title="Audio stumm/ein"
          >
            {useVoiceStore.getState().selfDeaf
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M3 18v-6a9 9 0 0114.5-7.13M21 12v6"/></svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3z"/><path d="M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/></svg>
            }
          </button>
          <button
            className="user-panel-btn"
            onClick={() => setShowUserSettings(true)}
            title="Einstellungen"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
          </button>
        </div>
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
