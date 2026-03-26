import { useEffect } from 'react';
import { useAuthStore } from './stores/auth';
import { useAppStore } from './stores/app';
import { AuthPage } from './components/layout/AuthPage';
import { AppLayout } from './components/layout/AppLayout';
import type { Message } from './api/client';

export function App() {
  const { user, gateway, isLoading, restore } = useAuthStore();
  const { addMessage, updateMessage, removeMessage } = useAppStore();

  // Restore session on mount
  useEffect(() => {
    restore();
  }, [restore]);

  // Subscribe to gateway events
  useEffect(() => {
    if (!gateway) return;

    const unsubs = [
      gateway.on('MESSAGE_CREATE', (data) => {
        addMessage(data as Message);
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
        <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <AppLayout />;
}
