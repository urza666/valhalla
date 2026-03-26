import { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/auth';
import { useAppStore } from '../../stores/app';
import { GuildSidebar } from '../guild/GuildSidebar';
import { ChannelSidebar } from '../guild/ChannelSidebar';
import { MemberList } from '../guild/MemberList';
import { ChatView } from '../chat/ChatView';
import { LiveKitRoom } from '../voice/LiveKitRoom';
import { FriendsView } from '../guild/FriendsView';

export function AppLayout() {
  const { user } = useAuthStore();
  const { guilds, selectedGuildId, selectedChannelId, loadGuilds, selectGuild } = useAppStore();
  const [showCreateGuild, setShowCreateGuild] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [showChannels, setShowChannels] = useState(false);

  useEffect(() => {
    loadGuilds();
  }, [loadGuilds]);

  const selectedGuild = guilds.find((g) => g.id === selectedGuildId);

  return (
    <div className={`app-layout ${showChannels ? 'show-channels' : ''}`} role="application">
      {/* Guild sidebar (leftmost) */}
      <GuildSidebar
        guilds={guilds}
        selectedGuildId={selectedGuildId}
        onSelectGuild={(id) => { setShowFriends(false); setShowChannels(true); selectGuild(id); }}
        onCreateGuild={() => setShowCreateGuild(true)}
        onShowFriends={() => { setShowFriends(true); setShowChannels(false); }}
        showFriends={showFriends}
      />

      {/* Friends view OR normal server view */}
      {showFriends ? (
        <FriendsView />
      ) : (
        <>
          {/* Channel sidebar */}
          {selectedGuild && (
            <ChannelSidebar
              guild={selectedGuild}
              user={user!}
              onChannelSelected={() => setShowChannels(false)}
            />
          )}

          {/* Chat area + Video + Member list */}
          {selectedChannelId ? (
            <>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <LiveKitRoom />
                <ChatView channelId={selectedChannelId} />
              </div>
              {selectedGuildId && <MemberList guildId={selectedGuildId} />}
            </>
          ) : (
            <div className="chat-area">
              <div className="empty-state">
                <div style={{ fontSize: 48, marginBottom: 8 }}>⚔️</div>
                <h2>Willkommen bei Valhalla</h2>
                <p>{guilds.length === 0 ? 'Erstelle einen Server, um loszulegen' : 'Wähle einen Kanal aus der Seitenleiste'}</p>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create guild modal */}
      {showCreateGuild && (
        <CreateGuildModal onClose={() => setShowCreateGuild(false)} />
      )}
    </div>
  );
}

function CreateGuildModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { createGuild } = useAppStore();

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await createGuild(name.trim());
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <form className="auth-form" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h1>Server erstellen</h1>
        <p>Gib deinem neuen Server einen Namen</p>
        <div className="form-group">
          <label>Servername</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={100}
            autoFocus
          />
        </div>
        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Erstellen...' : 'Erstellen'}
        </button>
      </form>
    </div>
  );
}
