import { useEffect } from 'react';
import { useVoiceStore } from '../../stores/voice';

/**
 * Global keyboard shortcuts:
 * - Ctrl+K: Search (handled in ChatView)
 * - Ctrl+Shift+M: Toggle mute
 * - Ctrl+Shift+D: Toggle deafen
 * - Escape: Close modals/panels (handled locally in components)
 * - Alt+ArrowUp/Down: Navigate channels
 */
export function KeyboardShortcuts() {
  const { connected, toggleMute, toggleDeaf } = useVoiceStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Shift+M: Toggle mute (only when in voice)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        if (connected) toggleMute();
        return;
      }

      // Ctrl+Shift+D: Toggle deafen
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        if (connected) toggleDeaf();
        return;
      }

      // Alt+ArrowUp/Down: Navigate channels
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        navigateChannels(e.key === 'ArrowUp' ? -1 : 1);
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [connected, toggleMute, toggleDeaf]);

  return null; // This component renders nothing, only registers handlers
}

function navigateChannels(direction: number) {
  const items = document.querySelectorAll<HTMLElement>('.channel-item:not(.voice)');
  if (items.length === 0) return;

  const activeIndex = Array.from(items).findIndex((el) => el.classList.contains('active'));
  let nextIndex = activeIndex + direction;
  if (nextIndex < 0) nextIndex = items.length - 1;
  if (nextIndex >= items.length) nextIndex = 0;

  items[nextIndex]?.click();
}
