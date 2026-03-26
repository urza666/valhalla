import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from './settings';

describe('Settings Store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('has sensible defaults', () => {
    const state = useSettingsStore.getState();
    expect(state.theme).toBe('dark');
    expect(state.fontSize).toBe(16);
    expect(state.compactMode).toBe(false);
  });

  it('toggles compact mode', () => {
    useSettingsStore.getState().toggleCompactMode();
    expect(useSettingsStore.getState().compactMode).toBe(true);
    useSettingsStore.getState().toggleCompactMode();
    expect(useSettingsStore.getState().compactMode).toBe(false);
  });
});
