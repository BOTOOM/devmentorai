/**
 * Keyboard Shortcuts Hook
 * 
 * Provides keyboard shortcut handling for DevMentorAI extension.
 * Supports global shortcuts and context-specific bindings.
 */

import { useEffect, useCallback, useRef } from 'react';
import React from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  handler: () => void;
  enabled?: boolean;
}

export const DEFAULT_SHORTCUTS: Omit<KeyboardShortcut, 'handler'>[] = [
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

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  shortcuts: KeyboardShortcut[];
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

export function useKeyboardShortcuts({ enabled = true, shortcuts }: UseKeyboardShortcutsOptions): void {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;
  
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't trigger shortcuts when typing in inputs (except for specific ones)
    const target = event.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || 
                    target.tagName === 'TEXTAREA' || 
                    target.isContentEditable;
    
    for (const shortcut of shortcutsRef.current) {
      if (matchesShortcut(event, shortcut)) {
        // Allow Escape and Ctrl+Enter in inputs
        if (isInput && shortcut.key !== 'Escape' && !(shortcut.key === 'Enter' && shortcut.ctrl)) {
          continue;
        }
        
        event.preventDefault();
        event.stopPropagation();
        shortcut.handler();
        return;
      }
    }
  }, []);
  
  useEffect(() => {
    if (!enabled) return;
    
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [enabled, handleKeyDown]);
}

/**
 * Format shortcut for display
 */
export function formatShortcut(shortcut: Omit<KeyboardShortcut, 'handler'>): string {
  const parts: string[] = [];
  
  // Use platform-specific modifier symbols
  const isMac = navigator.platform.toLowerCase().includes('mac');
  
  if (shortcut.ctrl) parts.push(isMac ? '⌃' : 'Ctrl');
  if (shortcut.alt) parts.push(isMac ? '⌥' : 'Alt');
  if (shortcut.shift) parts.push(isMac ? '⇧' : 'Shift');
  if (shortcut.meta) parts.push(isMac ? '⌘' : 'Win');
  
  // Format key
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

/**
 * Keyboard Shortcuts Help Modal Content
 */
export function KeyboardShortcutsHelp(): React.ReactElement {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">Keyboard Shortcuts</h3>
      <div className="space-y-2">
        {DEFAULT_SHORTCUTS.map((shortcut, index) => (
          <div key={index} className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">{shortcut.description}</span>
            <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">
              {formatShortcut(shortcut)}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

