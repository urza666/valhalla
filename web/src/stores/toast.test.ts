import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useToastStore, toast } from './toast';

describe('Toast Store', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
    vi.useFakeTimers();
  });

  it('adds a toast', () => {
    toast.success('Test message');
    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Test message');
    expect(toasts[0].type).toBe('success');
  });

  it('adds error toast', () => {
    toast.error('Error occurred');
    const { toasts } = useToastStore.getState();
    expect(toasts[0].type).toBe('error');
  });

  it('adds info toast', () => {
    toast.info('Information');
    const { toasts } = useToastStore.getState();
    expect(toasts[0].type).toBe('info');
  });

  it('auto-removes toast after 4 seconds', () => {
    toast.success('Will disappear');
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(4100);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('manually removes toast', () => {
    toast.success('Removable');
    const id = useToastStore.getState().toasts[0].id;
    useToastStore.getState().removeToast(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('handles multiple toasts', () => {
    toast.success('First');
    toast.error('Second');
    toast.info('Third');
    expect(useToastStore.getState().toasts).toHaveLength(3);
  });
});
