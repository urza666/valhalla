/**
 * VoiceView — Main Discord-like 3-column layout.
 * ServerBar | ChannelSidebar | Content (Chat/Board/Wiki/Voice/Friends) | MembersPanel
 *
 * All data from Valhalla stores (WebSocket events) + api/client.ts (fetch).
 */
import { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/auth';
import { useAppStore } from '../../stores/app';
import { ServerBar } from './ServerBar';
import { ChannelSidebar } from './ChannelSidebar';
import { ChatArea } from './ChatArea';
import { FriendsPanel } from './FriendsPanel';
import { MembersPanel } from './MembersPanel';

export function VoiceView() {
  useAuthStore();
  const { guilds, selectedGuildId, selectedChannelId, loadGuilds, selectGuild, selectChannel, channels } = useAppStore();
  const [showFriends, setShowFriends] = useState(false);
  const [dmChannelId, setDmChannelId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'chat' | 'board' | 'wiki' | 'friends'>('chat');

  useEffect(() => { loadGuilds(); }, [loadGuilds]);

  // DM open events
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.channelId) {
        setDmChannelId(detail.channelId);
        setShowFriends(false);
        setActiveView('chat');
        selectChannel(detail.channelId);
      }
    };
    window.addEventListener('valhalla:open-dm', handler);
    return () => window.removeEventListener('valhalla:open-dm', handler);
  }, [selectChannel]);

  const selectedGuild = guilds.find((g) => g.id === selectedGuildId);

  const handleSelectGuild = (id: string) => {
    setShowFriends(false);
    setDmChannelId(null);
    setActiveView('chat');
    selectGuild(id);
  };

  const showDm = dmChannelId && selectedChannelId === dmChannelId;

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw',
      background: 'var(--bg-primary, #0e1218)',
      color: 'var(--text-primary, #dde4ef)',
      fontFamily: 'var(--font-primary, Inter, -apple-system, sans-serif)',
      overflow: 'hidden',
    }}>
      {/* Server bar */}
      <ServerBar
        guilds={guilds}
        selectedGuildId={selectedGuildId}
        onSelectGuild={handleSelectGuild}
        onShowFriends={() => { setShowFriends(true); setDmChannelId(null); setActiveView('friends'); }}
        showFriends={showFriends}
      />

      {/* Channel sidebar (when guild selected) */}
      {selectedGuild && !showFriends && (
        <ChannelSidebar
          guild={selectedGuild}
          activeView={activeView}
          onSetView={(v) => setActiveView(v as typeof activeView)}
          onChannelSelected={() => {}}
        />
      )}

      {/* Main content + members panel */}
      <main style={{ flex: 1, display: 'flex', minWidth: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg-primary, #0e1218)' }}>
          {showFriends || activeView === 'friends' ? (
            <FriendsPanel />
          ) : showDm ? (
            <ChatArea channelId={dmChannelId!} channelName="DM" guildId={null} viewMode="chat" onSetViewMode={() => {}} />
          ) : selectedChannelId ? (
            <ChatArea
              channelId={selectedChannelId}
              channelName={getChannelName(channels, selectedGuildId, selectedChannelId)}
              guildId={selectedGuildId}
              viewMode={activeView}
              onSetViewMode={(v) => setActiveView(v as typeof activeView)}
            />
          ) : (
            <WelcomeScreen hasGuilds={guilds.length > 0} />
          )}
        </div>

        {/* Members panel (right sidebar, when in guild + chat mode) */}
        {selectedGuildId && !showFriends && activeView === 'chat' && selectedChannelId && (
          <MembersPanel guildId={selectedGuildId} />
        )}
      </main>
    </div>
  );
}

function WelcomeScreen({ hasGuilds }: { hasGuilds: boolean }) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 64 }}>⚔️</div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--brand-primary, #c8a84a)' }}>Willkommen bei Valhalla</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
        {hasGuilds ? 'Waehle einen Server aus der Seitenleiste' : 'Erstelle einen Server, um loszulegen'}
      </p>
    </div>
  );
}

function getChannelName(channels: Map<string, { id: string; name: string | null }[]>, guildId: string | null, channelId: string): string {
  if (!guildId) return channelId;
  const guildChannels = channels.get(guildId) || [];
  const ch = guildChannels.find((c) => c.id === channelId);
  return ch?.name || channelId;
}
