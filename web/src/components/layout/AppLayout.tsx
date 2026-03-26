import { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/auth';
import { useAppStore } from '../../stores/app';
import { GuildSidebar } from '../guild/GuildSidebar';
import { ChannelSidebar } from '../guild/ChannelSidebar';
import { MemberList } from '../guild/MemberList';
import { ChatView } from '../chat/ChatView';
import { LiveKitRoom } from '../voice/LiveKitRoom';
import { FriendsView } from '../guild/FriendsView';
import { OnboardingWizard } from './OnboardingWizard';

export function AppLayout() {
  const { user } = useAuthStore();
  const { guilds, selectedGuildId, selectedChannelId, loadGuilds, selectGuild, selectChannel } = useAppStore();
  const [showCreateGuild, setShowCreateGuild] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [showChannels, setShowChannels] = useState(false);
  const [dmChannelId, setDmChannelId] = useState<string | null>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => localStorage.getItem('onboarding_done') === 'true');

  useEffect(() => {
    loadGuilds();
  }, [loadGuilds]);

  // Listen for DM open events from UserProfilePopout / MemberList
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.channelId) {
        setDmChannelId(detail.channelId);
        setShowFriends(false);
        // Load messages for this DM channel
        selectChannel(detail.channelId);
      }
    };
    window.addEventListener('valhalla:open-dm', handler);
    return () => window.removeEventListener('valhalla:open-dm', handler);
  }, [selectChannel]);

  const selectedGuild = guilds.find((g) => g.id === selectedGuildId);

  // When selecting a guild, clear DM state
  const handleSelectGuild = (id: string) => {
    setShowFriends(false);
    setShowChannels(true);
    setDmChannelId(null);
    selectGuild(id);
  };

  const showDm = dmChannelId && selectedChannelId === dmChannelId;

  return (
    <div className={`app-layout ${showChannels ? 'show-channels' : ''}`} role="application">
      {/* Guild sidebar (leftmost) */}
      <GuildSidebar
        guilds={guilds}
        selectedGuildId={selectedGuildId}
        onSelectGuild={handleSelectGuild}
        onCreateGuild={() => setShowCreateGuild(true)}
        onShowFriends={() => { setShowFriends(true); setShowChannels(false); setDmChannelId(null); }}
        showFriends={showFriends}
      />

      {/* DM direct view */}
      {showDm ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <ChatView channelId={dmChannelId!} />
        </div>
      ) : showFriends ? (
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

      {/* Onboarding wizard for new users */}
      {guilds.length === 0 && !onboardingDismissed && (
        <OnboardingWizard onComplete={() => { setOnboardingDismissed(true); localStorage.setItem('onboarding_done', 'true'); }} />
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
