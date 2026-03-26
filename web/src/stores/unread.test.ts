import { describe, it, expect, beforeEach } from 'vitest';
import { useUnreadStore } from './unread';

describe('Unread Store', () => {
  beforeEach(() => {
    useUnreadStore.setState({ unreadCounts: new Map(), lastRead: new Map() });
  });

  it('starts with zero unread', () => {
    expect(useUnreadStore.getState().getUnread('channel-1')).toBe(0);
  });

  it('increments unread count', () => {
    useUnreadStore.getState().incrementUnread('channel-1');
    expect(useUnreadStore.getState().getUnread('channel-1')).toBe(1);

    useUnreadStore.getState().incrementUnread('channel-1');
    expect(useUnreadStore.getState().getUnread('channel-1')).toBe(2);
  });

  it('tracks separate channels', () => {
    useUnreadStore.getState().incrementUnread('ch-1');
    useUnreadStore.getState().incrementUnread('ch-2');
    useUnreadStore.getState().incrementUnread('ch-2');

    expect(useUnreadStore.getState().getUnread('ch-1')).toBe(1);
    expect(useUnreadStore.getState().getUnread('ch-2')).toBe(2);
  });

  it('marks channel as read', () => {
    useUnreadStore.getState().incrementUnread('ch-1');
    useUnreadStore.getState().incrementUnread('ch-1');
    useUnreadStore.getState().incrementUnread('ch-1');

    useUnreadStore.getState().markRead('ch-1', 'msg-123');

    expect(useUnreadStore.getState().getUnread('ch-1')).toBe(0);
    expect(useUnreadStore.getState().lastRead.get('ch-1')).toBe('msg-123');
  });

  it('markRead does not affect other channels', () => {
    useUnreadStore.getState().incrementUnread('ch-1');
    useUnreadStore.getState().incrementUnread('ch-2');

    useUnreadStore.getState().markRead('ch-1', 'msg-1');

    expect(useUnreadStore.getState().getUnread('ch-1')).toBe(0);
    expect(useUnreadStore.getState().getUnread('ch-2')).toBe(1);
  });
});
