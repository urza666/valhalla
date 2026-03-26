import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../stores/auth';
import { api } from '../../api/client';

interface Props {
  channelId: string;
}

interface TypingUser {
  id: string;
  username: string;
  expiresAt: number;
}

export function TypingIndicator({ channelId }: Props) {
  const { gateway, user: currentUser } = useAuthStore();
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingUser>>(new Map());
  const usernameCache = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!gateway) return;

    const unsub = gateway.on('TYPING_START', (data: unknown) => {
      const { channel_id, user_id, username } = data as {
        channel_id: string;
        user_id: string;
        username?: string;
        timestamp: number;
      };
      if (channel_id !== channelId) return;
      // Don't show own typing
      if (user_id === currentUser?.id) return;

      // Use username from event, cache, or fallback
      const displayName = username || usernameCache.current.get(user_id) || `Nutzer ${user_id.slice(-4)}`;
      if (username) usernameCache.current.set(user_id, username);

      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.set(user_id, {
          id: user_id,
          username: displayName,
          expiresAt: Date.now() + 10000,
        });
        return next;
      });
    });

    // Cleanup expired typing indicators
    const interval = setInterval(() => {
      setTypingUsers((prev) => {
        const now = Date.now();
        const next = new Map(prev);
        for (const [id, user] of next) {
          if (now >= user.expiresAt) {
            next.delete(id);
          }
        }
        return next.size !== prev.size ? next : prev;
      });
    }, 2000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [gateway, channelId, currentUser?.id]);

  // Clear typing when channel changes
  useEffect(() => {
    setTypingUsers(new Map());
  }, [channelId]);

  const users = Array.from(typingUsers.values());
  if (users.length === 0) return null;

  const text =
    users.length === 1
      ? `${users[0].username} tippt...`
      : users.length === 2
        ? `${users[0].username} und ${users[1].username} tippen...`
        : users.length === 3
          ? `${users[0].username}, ${users[1].username} und ${users[2].username} tippen...`
          : 'Mehrere Personen tippen...';

  return (
    <div style={{
      padding: '0 16px 4px',
      fontSize: 12,
      color: 'var(--text-muted)',
      height: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 4,
    }}>
      <TypingDots />
      <span>{text}</span>
    </div>
  );
}

function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: 'var(--text-muted)',
            animation: `typingBounce 1.4s infinite ${i * 0.2}s`,
          }}
        />
      ))}
    </span>
  );
}
