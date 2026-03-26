import { useEffect } from 'react';
import { useAuthStore } from './stores/auth';
import { useAppStore } from './stores/app';
import { useSettingsStore } from './stores/settings';
import { AuthPage } from './components/layout/AuthPage';
import { AppLayout } from './components/layout/AppLayout';
import { ToastContainer } from './components/common/ToastContainer';
import type { Message } from './api/client';

export function App() {
  const { user, gateway, isLoading, restore } = useAuthStore();
  const { addMessage, updateMessage, removeMessage } = useAppStore();
  const { sendNotification } = useSettingsStore();

  // Restore session on mount
  useEffect(() => {
    restore();
  }, [restore]);

  // Subscribe to gateway events
  useEffect(() => {
    if (!gateway) return;

    const unsubs = [
      gateway.on('MESSAGE_CREATE', (data) => {
        const msg = data as Message;
        addMessage(msg);
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
  }, [gateway, addMessage, updateMessage, removeMessage]);

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
    </>
  );
}
