/**
 * Unit tests for keyboard shortcuts utilities
 * Tests shortcut matching, formatting, and default shortcuts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';

// Re-implement the utility functions for testing
interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  handler: () => void;
  enabled?: boolean;
}

function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  if (shortcut.enabled === false) return false;
  
  const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase() ||
                   event.code === shortcut.key;
  
  return (
    keyMatch &&
    !!event.ctrlKey === !!shortcut.ctrl &&
    !!event.shiftKey === !!shortcut.shift &&
    !!event.altKey === !!shortcut.alt &&
    !!event.metaKey === !!shortcut.meta
  );
}

function formatShortcut(shortcut: Omit<KeyboardShortcut, 'handler'>, isMac: boolean = false): string {
  const parts: string[] = [];
  
  if (shortcut.ctrl) parts.push(isMac ? '⌃' : 'Ctrl');
  if (shortcut.alt) parts.push(isMac ? '⌥' : 'Alt');
  if (shortcut.shift) parts.push(isMac ? '⇧' : 'Shift');
  if (shortcut.meta) parts.push(isMac ? '⌘' : 'Win');
  
  let keyDisplay = shortcut.key;
  switch (shortcut.key) {
    case 'ArrowUp': keyDisplay = '↑'; break;
    case 'ArrowDown': keyDisplay = '↓'; break;
    case 'ArrowLeft': keyDisplay = '←'; break;
    case 'ArrowRight': keyDisplay = '→'; break;
    case 'Enter': keyDisplay = '↵'; break;
    case 'Escape': keyDisplay = 'Esc'; break;
    case ' ': keyDisplay = 'Space'; break;
    default: keyDisplay = keyDisplay.toUpperCase();
  }
  
  parts.push(keyDisplay);
  
  return isMac ? parts.join('') : parts.join('+');
}

// Default shortcuts definition
const DEFAULT_SHORTCUTS: Omit<KeyboardShortcut, 'handler'>[] = [
  { key: 'n', ctrl: true, shift: true, description: 'Create new session' },
  { key: 'k', ctrl: true, description: 'Focus chat input' },
  { key: 'Escape', description: 'Close modal / Cancel' },
  { key: '/', ctrl: true, description: 'Show keyboard shortcuts' },
  { key: '1', ctrl: true, alt: true, description: 'Switch to DevOps session' },
  { key: '2', ctrl: true, alt: true, description: 'Switch to Writing session' },
  { key: '3', ctrl: true, alt: true, description: 'Switch to Development session' },
  { key: 's', ctrl: true, shift: true, description: 'Open settings' },
  { key: 'Enter', ctrl: true, description: 'Send message' },
  { key: 'ArrowUp', alt: true, description: 'Previous session' },
  { key: 'ArrowDown', alt: true, description: 'Next session' },
];

describe('Keyboard Shortcuts', () => {
  describe('DEFAULT_SHORTCUTS', () => {
    it('should have create new session shortcut', () => {
      const shortcut = DEFAULT_SHORTCUTS.find(s => s.description === 'Create new session');
      expect(shortcut).toBeDefined();
      expect(shortcut?.ctrl).toBe(true);
      expect(shortcut?.shift).toBe(true);
      expect(shortcut?.key).toBe('n');
    });

    it('should have focus chat input shortcut', () => {
      const shortcut = DEFAULT_SHORTCUTS.find(s => s.description === 'Focus chat input');
      expect(shortcut).toBeDefined();
      expect(shortcut?.ctrl).toBe(true);
      expect(shortcut?.key).toBe('k');
    });

    it('should have escape for close/cancel', () => {
      const shortcut = DEFAULT_SHORTCUTS.find(s => s.key === 'Escape');
      expect(shortcut).toBeDefined();
      expect(shortcut?.ctrl).toBeUndefined();
      expect(shortcut?.shift).toBeUndefined();
    });

    it('should have send message shortcut', () => {
      const shortcut = DEFAULT_SHORTCUTS.find(s => s.description === 'Send message');
      expect(shortcut).toBeDefined();
      expect(shortcut?.ctrl).toBe(true);
      expect(shortcut?.key).toBe('Enter');
    });

    it('should have session navigation shortcuts', () => {
      const prevSession = DEFAULT_SHORTCUTS.find(s => s.description === 'Previous session');
      const nextSession = DEFAULT_SHORTCUTS.find(s => s.description === 'Next session');
      
      expect(prevSession).toBeDefined();
      expect(prevSession?.alt).toBe(true);
      expect(prevSession?.key).toBe('ArrowUp');
      
      expect(nextSession).toBeDefined();
      expect(nextSession?.alt).toBe(true);
      expect(nextSession?.key).toBe('ArrowDown');
    });

    it('should have session type shortcuts (1-3)', () => {
      const devops = DEFAULT_SHORTCUTS.find(s => s.description.includes('DevOps'));
      const writing = DEFAULT_SHORTCUTS.find(s => s.description.includes('Writing'));
      const development = DEFAULT_SHORTCUTS.find(s => s.description.includes('Development'));
      
      expect(devops?.key).toBe('1');
      expect(writing?.key).toBe('2');
      expect(development?.key).toBe('3');
      
      // All should have Ctrl+Alt
      [devops, writing, development].forEach(s => {
        expect(s?.ctrl).toBe(true);
        expect(s?.alt).toBe(true);
      });
    });

    it('should have open settings shortcut', () => {
      const shortcut = DEFAULT_SHORTCUTS.find(s => s.description === 'Open settings');
      expect(shortcut).toBeDefined();
      expect(shortcut?.ctrl).toBe(true);
      expect(shortcut?.shift).toBe(true);
      expect(shortcut?.key).toBe('s');
    });

    it('should have show shortcuts help', () => {
      const shortcut = DEFAULT_SHORTCUTS.find(s => s.description === 'Show keyboard shortcuts');
      expect(shortcut).toBeDefined();
      expect(shortcut?.ctrl).toBe(true);
      expect(shortcut?.key).toBe('/');
    });
  });

  describe('matchesShortcut', () => {
    function createKeyEvent(options: Partial<{
      key: string;
      code: string;
      ctrlKey: boolean;
      shiftKey: boolean;
      altKey: boolean;
      metaKey: boolean;
    }> = {}): KeyboardEvent {
      return {
        key: options.key || '',
        code: options.code || '',
        ctrlKey: options.ctrlKey || false,
        shiftKey: options.shiftKey || false,
        altKey: options.altKey || false,
        metaKey: options.metaKey || false,
      } as KeyboardEvent;
    }

    it('should match simple key', () => {
      const shortcut: KeyboardShortcut = {
        key: 'Escape',
        description: 'Close',
        handler: vi.fn(),
      };
      
      const event = createKeyEvent({ key: 'Escape' });
      expect(matchesShortcut(event, shortcut)).toBe(true);
    });

    it('should match Ctrl+key', () => {
      const shortcut: KeyboardShortcut = {
        key: 'k',
        ctrl: true,
        description: 'Focus',
        handler: vi.fn(),
      };
      
      const matchingEvent = createKeyEvent({ key: 'k', ctrlKey: true });
      const nonMatchingEvent = createKeyEvent({ key: 'k' });
      
      expect(matchesShortcut(matchingEvent, shortcut)).toBe(true);
      expect(matchesShortcut(nonMatchingEvent, shortcut)).toBe(false);
    });

    it('should match Ctrl+Shift+key', () => {
      const shortcut: KeyboardShortcut = {
        key: 'n',
        ctrl: true,
        shift: true,
        description: 'New',
        handler: vi.fn(),
      };
      
      const matchingEvent = createKeyEvent({ key: 'n', ctrlKey: true, shiftKey: true });
      const onlyCtrl = createKeyEvent({ key: 'n', ctrlKey: true });
      const onlyShift = createKeyEvent({ key: 'n', shiftKey: true });
      
      expect(matchesShortcut(matchingEvent, shortcut)).toBe(true);
      expect(matchesShortcut(onlyCtrl, shortcut)).toBe(false);
      expect(matchesShortcut(onlyShift, shortcut)).toBe(false);
    });

    it('should match Ctrl+Alt+key', () => {
      const shortcut: KeyboardShortcut = {
        key: '1',
        ctrl: true,
        alt: true,
        description: 'Session 1',
        handler: vi.fn(),
      };
      
      const matching = createKeyEvent({ key: '1', ctrlKey: true, altKey: true });
      expect(matchesShortcut(matching, shortcut)).toBe(true);
    });

    it('should match Alt+Arrow', () => {
      const shortcut: KeyboardShortcut = {
        key: 'ArrowUp',
        alt: true,
        description: 'Previous',
        handler: vi.fn(),
      };
      
      const matching = createKeyEvent({ key: 'ArrowUp', altKey: true });
      expect(matchesShortcut(matching, shortcut)).toBe(true);
    });

    it('should not match when disabled', () => {
      const shortcut: KeyboardShortcut = {
        key: 'k',
        ctrl: true,
        description: 'Focus',
        handler: vi.fn(),
        enabled: false,
      };
      
      const event = createKeyEvent({ key: 'k', ctrlKey: true });
      expect(matchesShortcut(event, shortcut)).toBe(false);
    });

    it('should be case insensitive for keys', () => {
      const shortcut: KeyboardShortcut = {
        key: 'K',
        ctrl: true,
        description: 'Focus',
        handler: vi.fn(),
      };
      
      const event = createKeyEvent({ key: 'k', ctrlKey: true });
      expect(matchesShortcut(event, shortcut)).toBe(true);
    });

    it('should match by code when key does not match', () => {
      const shortcut: KeyboardShortcut = {
        key: 'ArrowUp',
        alt: true,
        description: 'Previous',
        handler: vi.fn(),
      };
      
      const event = createKeyEvent({ key: 'Up', code: 'ArrowUp', altKey: true });
      expect(matchesShortcut(event, shortcut)).toBe(true);
    });

    it('should not match if extra modifiers pressed', () => {
      const shortcut: KeyboardShortcut = {
        key: 'k',
        ctrl: true,
        description: 'Focus',
        handler: vi.fn(),
      };
      
      // Pressing Ctrl+Shift+K when shortcut is Ctrl+K
      const event = createKeyEvent({ key: 'k', ctrlKey: true, shiftKey: true });
      expect(matchesShortcut(event, shortcut)).toBe(false);
    });
  });

  describe('formatShortcut', () => {
    it('should format simple key', () => {
      const shortcut = { key: 'Escape', description: 'Close' };
      expect(formatShortcut(shortcut, false)).toBe('Esc');
    });

    it('should format Ctrl+key for Windows', () => {
      const shortcut = { key: 'k', ctrl: true, description: 'Focus' };
      expect(formatShortcut(shortcut, false)).toBe('Ctrl+K');
    });

    it('should format Ctrl+key for Mac', () => {
      const shortcut = { key: 'k', ctrl: true, description: 'Focus' };
      expect(formatShortcut(shortcut, true)).toBe('⌃K');
    });

    it('should format Ctrl+Shift+key for Windows', () => {
      const shortcut = { key: 'n', ctrl: true, shift: true, description: 'New' };
      expect(formatShortcut(shortcut, false)).toBe('Ctrl+Shift+N');
    });

    it('should format Ctrl+Shift+key for Mac', () => {
      const shortcut = { key: 'n', ctrl: true, shift: true, description: 'New' };
      expect(formatShortcut(shortcut, true)).toBe('⌃⇧N');
    });

    it('should format Ctrl+Alt+key for Windows', () => {
      const shortcut = { key: '1', ctrl: true, alt: true, description: 'Session' };
      expect(formatShortcut(shortcut, false)).toBe('Ctrl+Alt+1');
    });

    it('should format Ctrl+Alt+key for Mac', () => {
      const shortcut = { key: '1', ctrl: true, alt: true, description: 'Session' };
      expect(formatShortcut(shortcut, true)).toBe('⌃⌥1');
    });

    it('should format arrow keys correctly', () => {
      expect(formatShortcut({ key: 'ArrowUp', alt: true, description: 'Up' }, false))
        .toBe('Alt+↑');
      expect(formatShortcut({ key: 'ArrowDown', alt: true, description: 'Down' }, false))
        .toBe('Alt+↓');
      expect(formatShortcut({ key: 'ArrowLeft', description: 'Left' }, false))
        .toBe('←');
      expect(formatShortcut({ key: 'ArrowRight', description: 'Right' }, false))
        .toBe('→');
    });

    it('should format Enter key', () => {
      const shortcut = { key: 'Enter', ctrl: true, description: 'Send' };
      expect(formatShortcut(shortcut, false)).toBe('Ctrl+↵');
      expect(formatShortcut(shortcut, true)).toBe('⌃↵');
    });

    it('should format Space key', () => {
      const shortcut = { key: ' ', ctrl: true, description: 'Toggle' };
      expect(formatShortcut(shortcut, false)).toBe('Ctrl+Space');
    });

    it('should format Meta key for Windows', () => {
      const shortcut = { key: 'k', meta: true, description: 'Focus' };
      expect(formatShortcut(shortcut, false)).toBe('Win+K');
    });

    it('should format Meta key for Mac', () => {
      const shortcut = { key: 'k', meta: true, description: 'Focus' };
      expect(formatShortcut(shortcut, true)).toBe('⌘K');
    });

    it('should uppercase regular keys', () => {
      const shortcut = { key: 's', ctrl: true, shift: true, description: 'Save' };
      expect(formatShortcut(shortcut, false)).toBe('Ctrl+Shift+S');
    });
  });

  describe('Shortcut Uniqueness', () => {
    it('should have unique shortcuts (no conflicts)', () => {
      const combos = DEFAULT_SHORTCUTS.map(s => {
        const mods = [
          s.ctrl ? 'ctrl' : '',
          s.alt ? 'alt' : '',
          s.shift ? 'shift' : '',
          s.meta ? 'meta' : '',
        ].filter(Boolean).join('+');
        return `${mods}+${s.key}`.toLowerCase();
      });
      
      const uniqueCombos = new Set(combos);
      expect(combos.length).toBe(uniqueCombos.size);
    });
  });
});
