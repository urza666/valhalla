/**
 * ChannelSidebar — LPP-identical channel list with voice channels + user panel.
 */
import { useState } from 'react';
import { useAppStore } from '../../stores/app';
import { useVoiceStore } from '../../stores/voice';
import { useUnreadStore } from '../../stores/unread';
import { api } from '../../api/client';
import { toast } from '../../stores/toast';
import { useAuthStore } from '../../stores/auth';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { ServerSettingsModal } from './ServerSettingsModal';
import { ChannelSettingsModal } from './ChannelSettingsModal';
import { InviteModal } from './InviteModal';
import type { Guild, Channel } from '../../api/client';

const EMPTY_CHANNELS: Channel[] = [];

interface Props {
  guild: Guild;
  onChannelSelected?: () => void;
  activeView: string;
  onSetView: (view: string) => void;
}

export function ChannelSidebar({ guild, onChannelSelected, activeView, onSetView }: Props) {
  const user = useAuthStore((s) => s.user);
  const guildChannels = useAppStore((s) => s.channels.get(guild.id) ?? EMPTY_CHANNELS);
  const selectedChannelId = useAppStore((s) => s.selectedChannelId);
  const voiceChannelId = useVoiceStore((s) => s.channelId);
  const connected = useVoiceStore((s) => s.connected);
  const selfMute = useVoiceStore((s) => s.selfMute);
  const selfDeaf = useVoiceStore((s) => s.selfDeaf);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<0 | 2>(0);
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [editChannel, setEditChannel] = useState<Channel | null>(null);
  const [inviteChannelId, setInviteChannelId] = useState<string | null>(null);

  const categories = guildChannels.filter((c) => c.type === 4);
  const uncategorized = guildChannels.filter((c) => c.type !== 4 && !c.parent_id);
  const isOwner = guild.owner_id === user?.id;

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return;
    try {
      await api.createChannel(guild.id, newChannelName.trim(), newChannelType);
      useAppStore.getState().loadGuilds();
      setNewChannelName('');
      setShowCreateChannel(false);
    } catch { toast.error('Kanal konnte nicht erstellt werden'); }
  };

  return (
    <aside style={{
      width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column',
      background: 'var(--bg-primary, #0e1218)',
      borderRight: '1px solid var(--color-voice-border, rgba(255,255,255,0.06))',
    }}>
      {/* Server header */}
      <div style={{
        padding: '12px 16px', fontWeight: 700, fontSize: 15,
        borderBottom: '1px solid var(--color-voice-border, rgba(255,255,255,0.06))',
        color: 'var(--text-primary, #dde4ef)', cursor: 'pointer',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{guild.name}</span>
        {isOwner && <span onClick={(e) => { e.stopPropagation(); setShowServerSettings(true); }} style={{ fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer' }}>⚙</span>}
      </div>

      {/* Channel list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {/* Text channels header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 12px 4px', fontSize: 11, fontWeight: 700,
          color: 'var(--text-muted, #4a5568)', textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          <span>Textkanäle</span>
          {isOwner && (
            <span onClick={() => { setNewChannelType(0); setShowCreateChannel(true); }}
              style={{ cursor: 'pointer', fontSize: 16 }} title="Kanal erstellen">+</span>
          )}
        </div>

        {uncategorized.filter(c => c.type === 0).map((ch) => (
          <ChannelItem key={ch.id} channel={ch}
            active={ch.id === selectedChannelId && activeView === 'chat'}
            onSelect={() => { useAppStore.getState().selectChannel(ch.id); onSetView('chat'); onChannelSelected?.(); }} />
        ))}

        {categories.map((cat) => {
          const children = guildChannels.filter((c) => c.parent_id === cat.id);
          return (
            <div key={cat.id}>
              <div style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {cat.name}
              </div>
              {children.map((ch) => (
                <ChannelItem key={ch.id} channel={ch}
                  active={ch.id === selectedChannelId && activeView === 'chat'}
                  onSelect={() => {
                    if (ch.type === 2) useVoiceStore.getState().joinChannel(guild.id, ch.id);
                    else { useAppStore.getState().selectChannel(ch.id); onSetView('chat'); onChannelSelected?.(); }
                  }} />
              ))}
            </div>
          );
        })}

        {/* Voice channels header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 12px 4px', fontSize: 11, fontWeight: 700,
          color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          <span>Sprachkanäle</span>
          {isOwner && (
            <span onClick={() => { setNewChannelType(2); setShowCreateChannel(true); }}
              style={{ cursor: 'pointer', fontSize: 16 }} title="Sprachkanal erstellen">+</span>
          )}
        </div>

        {uncategorized.filter(c => c.type === 2).map((ch) => (
          <VoiceChannelItem key={ch.id} channel={ch}
            isConnected={voiceChannelId === ch.id}
            onJoin={() => useVoiceStore.getState().joinChannel(guild.id, ch.id)} />
        ))}
      </div>

      {/* Voice connected bar */}
      {connected && (
        <div style={{
          padding: '8px 12px',
          background: 'rgba(59,165,93,0.1)',
          borderTop: '1px solid var(--color-voice-border, rgba(255,255,255,0.06))',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-voice-online, #3ba55d)' }}>
              ● Sprache verbunden
            </div>
          </div>
          <button onClick={() => useVoiceStore.getState().leaveChannel()} title="Trennen" style={{
            background: 'rgba(237,66,69,0.2)', border: 'none', borderRadius: 4,
            padding: '4px 8px', cursor: 'pointer', color: '#ed4245',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 2v4m0 0v4m0-4h4m-4 0h-4" /><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3" />
            </svg>
          </button>
        </div>
      )}

      {/* User panel (bottom) */}
      {user && (
        <div style={{
          padding: '8px 12px',
          borderTop: '1px solid var(--color-voice-border, rgba(255,255,255,0.06))',
          background: 'var(--color-voice-surface, #1e1f22)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <UserAvatar
            user={{ username: user.username, display_name: user.display_name, avatar: user.avatar }}
            size={32} showStatus status="online"
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.display_name || user.username}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-voice-text-muted, #96989d)' }}>Online</div>
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            <IconBtn onClick={() => useVoiceStore.getState().toggleMute()} title={selfMute ? 'Mikrofon ein' : 'Mikrofon aus'} danger={selfMute}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path d="M19 10v2a7 7 0 01-14 0v-2" />
              </svg>
              {selfMute && <Slash />}
            </IconBtn>
            <IconBtn onClick={() => useVoiceStore.getState().toggleDeaf()} title={selfDeaf ? 'Audio ein' : 'Audio aus'} danger={selfDeaf}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 18v-6a9 9 0 0118 0v6" /><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3z" /><path d="M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z" />
              </svg>
              {selfDeaf && <Slash />}
            </IconBtn>
          </div>
        </div>
      )}

      {/* Server settings modal */}
      <ServerSettingsModal guild={guild} isOpen={showServerSettings} onClose={() => setShowServerSettings(false)} />

      {/* Channel settings modal */}
      {editChannel && <ChannelSettingsModal channel={editChannel} isOpen={!!editChannel} onClose={() => setEditChannel(null)} />}

      {/* Invite modal */}
      {inviteChannelId && (
        <InviteModal channelId={inviteChannelId} channelName={guildChannels.find(c => c.id === inviteChannelId)?.name || ''} isOpen={!!inviteChannelId} onClose={() => setInviteChannelId(null)} />
      )}

      {/* Create channel modal */}
      {showCreateChannel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setShowCreateChannel(false)}>
          <div className="auth-form" onClick={(e) => e.stopPropagation()} style={{ animation: 'slideUp 0.3s ease' }}>
            <h1 style={{ fontSize: 18 }}>{newChannelType === 2 ? 'Sprachkanal' : 'Textkanal'} erstellen</h1>
            <div className="form-group">
              <label>Name</label>
              <input value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateChannel()} autoFocus />
            </div>
            <button className="btn-primary" style={{ width: '100%', padding: '8px' }} onClick={handleCreateChannel}>Erstellen</button>
          </div>
        </div>
      )}
    </aside>
  );
}

function ChannelItem({ channel, active, onSelect }: {
  channel: Channel; active: boolean; onSelect: () => void;
}) {
  const unreadCount = useUnreadStore((s) => s.unreadCounts.get(channel.id) || 0);
  const { markRead } = useUnreadStore();
  const icon = channel.type === 2 ? '🔊' : '#';

  return (
    <div
      onClick={() => { onSelect(); if (unreadCount > 0) markRead(channel.id, ''); }}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 12px', margin: '1px 8px', borderRadius: 4,
        cursor: 'pointer', fontSize: 14,
        background: active ? 'rgba(200,168,74,0.12)' : 'transparent',
        color: active ? '#fff' : unreadCount > 0 ? 'var(--text-primary, #dde4ef)' : 'var(--text-muted, #4a5568)',
        fontWeight: unreadCount > 0 ? 600 : 400,
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(200,168,74,0.06)'; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <span style={{ fontSize: 16, opacity: 0.6, width: 20, textAlign: 'center' }}>{icon}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{channel.name}</span>
      {unreadCount > 0 && (
        <span style={{
          background: 'var(--danger, #e85454)', color: '#fff',
          fontSize: 10, fontWeight: 700, borderRadius: 8,
          padding: '1px 5px', minWidth: 16, textAlign: 'center',
        }}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </div>
  );
}

function VoiceChannelItem({ channel, isConnected, onJoin }: {
  channel: Channel; isConnected: boolean; onJoin: () => void;
}) {
  return (
    <div
      onClick={onJoin}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 12px', margin: '1px 8px', borderRadius: 4,
        cursor: 'pointer', fontSize: 14,
        background: isConnected ? 'rgba(59,165,93,0.12)' : 'transparent',
        color: isConnected ? 'var(--color-voice-online, #3ba55d)' : 'var(--text-muted, #4a5568)',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => { if (!isConnected) (e.currentTarget as HTMLElement).style.background = 'rgba(200,168,74,0.06)'; }}
      onMouseLeave={(e) => { if (!isConnected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <span style={{ fontSize: 14, opacity: 0.6, width: 20, textAlign: 'center' }}>🔊</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{channel.name}</span>
      {isConnected && <span style={{ fontSize: 10, color: 'var(--color-voice-online)' }}>●</span>}
    </div>
  );
}

function IconBtn({ onClick, title, danger, children }: {
  onClick: () => void; title: string; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} title={title} style={{
      background: 'transparent', border: 'none', padding: 4, borderRadius: 4,
      cursor: 'pointer', color: danger ? '#ed4245' : 'var(--color-voice-text-muted, #96989d)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', transition: 'background 0.15s',
    }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}

function Slash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ position: 'absolute', top: 4, left: 4 }}>
      <line x1="3" y1="3" x2="21" y2="21" stroke="#ed4245" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
