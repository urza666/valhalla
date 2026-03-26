import { useEffect, useState } from 'react';
import { useAuthStore } from './stores/auth';
import { useAppStore } from './stores/app';
import { useSettingsStore } from './stores/settings';
import { AuthPage } from './components/layout/AuthPage';
import { AppLayout } from './components/layout/AppLayout';
import { ToastContainer } from './components/common/ToastContainer';
import { KeyboardShortcuts } from './components/common/KeyboardShortcuts';
import { useUnreadStore } from './stores/unread';
import { api } from './api/client';
import { toast } from './stores/toast';
import type { Message } from './api/client';

export function App() {
  const { user, gateway, isLoading, restore } = useAuthStore();
  const { addMessage, updateMessage, removeMessage, selectedChannelId, loadGuilds } = useAppStore();
  const { sendNotification } = useSettingsStore();
  const { incrementUnread } = useUnreadStore();
  const [inviteHandled, setInviteHandled] = useState(false);

  // Restore session on mount
  useEffect(() => {
    restore();
  }, [restore]);

  // Handle invite links: /invite/CODE or /join/CODE
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
          // Clean URL
          window.history.replaceState({}, '', '/');
        })
        .catch((err) => {
          if (err?.status === 409) {
            toast.info('Du bist bereits Mitglied dieses Servers');
          } else {
            toast.error('Einladung ungültig oder abgelaufen');
          }
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
        // Unread badge for non-active channels
        if (msg.channel_id !== selectedChannelId && msg.author.id !== user?.id) {
          incrementUnread(msg.channel_id);
        }
        // Desktop notification for messages from others
        if (msg.author.id !== user?.id) {
          sendNotification(
            msg.author.display_name || msg.author.username,
            msg.content.length > 100 ? msg.content.slice(0, 100) + '...' : msg.content
          );
        }
      }),
      gateway.on('MESSAGE_UPDATE', (data) => {
        updateMessage(data as Message);
      }),
      gateway.on('MESSAGE_DELETE', (data) => {
        const { id, channel_id } = data as { id: string; channel_id: string };
        removeMessage(channel_id, id);
      }),
    ];

    return () => unsubs.forEach((unsub) => unsub());
  }, [gateway, addMessage, updateMessage, removeMessage, selectedChannelId, user?.id, incrementUnread, sendNotification]);

  if (isLoading) {
    return (
      <div className="auth-container">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div className="loading-spinner large" />
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Verbindung wird hergestellt...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <>
      <AppLayout />
      <ToastContainer />
      <KeyboardShortcuts />
    </>
  );
}
