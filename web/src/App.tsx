import { useEffect, useState } from 'react';
import { useAuthStore } from './stores/auth';
import { useAppStore } from './stores/app';
import { useSettingsStore } from './stores/settings';
import { AuthPage } from './components/layout/AuthPage';
import { ToastContainer } from './components/common/ToastContainer';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { useUnreadStore } from './stores/unread';
import { api } from './api/client';
import { toast } from './stores/toast';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { VoiceView } from './features/voice/VoiceView';
import type { Message } from './api/client';

export function App() {
  const { user, gateway, isLoading, restore } = useAuthStore();
  const { addMessage, updateMessage, removeMessage, addReaction, removeReaction, selectedChannelId, loadGuilds } = useAppStore();
  const { sendNotification } = useSettingsStore();
  const { incrementUnread } = useUnreadStore();
  const [inviteHandled, setInviteHandled] = useState(false);

  // Restore session on mount
  useEffect(() => {
    restore();
  }, [restore]);

  // Handle invite links
  useEffect(() => {
    if (!user || inviteHandled) return;
    const path = window.location.pathname;
    const inviteMatch = path.match(/^\/(invite|join)\/([A-Za-z0-9_-]+)/);
    if (inviteMatch) {
      const code = inviteMatch[2];
      setInviteHandled(true);
      api.joinGuild(code)
        .then((data) => {
          toast.success(`Server "${data.guild.name}" beigetreten!`);
          loadGuilds();
          window.history.replaceState({}, '', '/');
        })
        .catch((err) => {
          if (err?.status === 409) toast.info('Du bist bereits Mitglied dieses Servers');
          else toast.error('Einladung ungueltig oder abgelaufen');
          window.history.replaceState({}, '', '/');
        });
    }
  }, [user, inviteHandled, loadGuilds]);

  // Subscribe to gateway events
  useEffect(() => {
    if (!gateway) return;
    const unsubs = [
      gateway.on('MESSAGE_CREATE', (data) => {
        const msg = data as Message;
        addMessage(msg);
        if (msg.channel_id !== selectedChannelId && msg.author.id !== user?.id) {
          incrementUnread(msg.channel_id);
        }
        if (msg.author.id !== user?.id) {
          sendNotification(
            msg.author.display_name || msg.author.username,
            msg.content.length > 100 ? msg.content.slice(0, 100) + '...' : msg.content
          );
        }
      }),
      gateway.on('MESSAGE_UPDATE', (data) => updateMessage(data as Message)),
      gateway.on('MESSAGE_DELETE', (data) => {
        const { id, channel_id } = data as { id: string; channel_id: string };
        removeMessage(channel_id, id);
      }),
      gateway.on('MESSAGE_REACTION_ADD', (data) => {
        const { channel_id, message_id, emoji, user_id } = data as { channel_id: string; message_id: string; emoji: string; user_id: string };
        addReaction(channel_id, message_id, emoji, user_id);
      }),
      gateway.on('MESSAGE_REACTION_REMOVE', (data) => {
        const { channel_id, message_id, emoji, user_id } = data as { channel_id: string; message_id: string; emoji: string; user_id: string };
        removeReaction(channel_id, message_id, emoji, user_id);
      }),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [gateway, addMessage, updateMessage, removeMessage, addReaction, removeReaction, selectedChannelId, user?.id, incrementUnread, sendNotification]);

  if (isLoading) {
    return (
      <div className="auth-container">
        <LoadingSpinner size="lg" />
        <div style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', marginTop: 8 }}>Verbindung wird hergestellt...</div>
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return (
    <ErrorBoundary>
      <VoiceView />
      <ToastContainer />
    </ErrorBoundary>
  );
}

