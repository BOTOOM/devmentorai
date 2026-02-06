/**
 * Hook for managing user settings with real-time application
 * Handles theme changes, language, and other preferences
 */
import { useState, useEffect, useCallback } from 'react';
import type { TextReplacementBehavior } from '@devmentorai/shared';

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  floatingBubbleEnabled: boolean;
  showSelectionToolbar: boolean;
  defaultSessionType: 'devops' | 'writing' | 'development' | 'general';
  language: string;
  translationLanguage: string; // Native language - for reading/understanding content
  targetTranslationLanguage: string; // Target language - for writing/output in editable fields
  backendUrl: string;
  communicationMode: 'http' | 'native'; // C.3 - HTTP vs Native Messaging
  /** Screenshot capture behavior when context mode is enabled */
  screenshotBehavior: 'disabled' | 'ask' | 'auto';
  /** Whether image attachments (paste/drag) are enabled */
  imageAttachmentsEnabled: boolean;
  /** Text replacement behavior when AI action is executed from editable field */
  textReplacementBehavior: TextReplacementBehavior;
  /** Model to use for quick actions (Writing Assistant) */
  quickActionModel: string;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  floatingBubbleEnabled: false,
  showSelectionToolbar: true,
  defaultSessionType: 'devops',
  language: 'en',
  translationLanguage: 'es', // Native language (for reading)
  targetTranslationLanguage: 'en', // Target language (for writing)
  backendUrl: 'http://localhost:3847',
  communicationMode: 'http',
  screenshotBehavior: 'ask', // Default: user must explicitly enable
  imageAttachmentsEnabled: true, // Default: enabled
  textReplacementBehavior: 'ask', // Default: ask before replacing
  quickActionModel: 'gpt-4.1', // Default: fast model for quick actions
};

const AVAILABLE_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'pt', name: 'Português' },
  { code: 'it', name: 'Italiano' },
  { code: 'ja', name: '日本語' },
  { code: 'zh', name: '中文' },
  { code: 'ko', name: '한국어' },
  { code: 'ru', name: 'Русский' },
];

export { AVAILABLE_LANGUAGES };

/**
 * Apply theme to document
 */
function applyTheme(theme: Settings['theme']) {
  const root = document.documentElement;
  
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  } else {
    root.classList.toggle('dark', theme === 'dark');
  }
}

/**
 * Listen for system theme changes
 */
function setupThemeListener(theme: Settings['theme']) {
  if (theme !== 'system') return () => {};
  
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (e: MediaQueryListEvent) => {
    document.documentElement.classList.toggle('dark', e.matches);
  };
  
  mediaQuery.addEventListener('change', handler);
  return () => mediaQuery.removeEventListener('change', handler);
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const result = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
        const loadedSettings = { ...DEFAULT_SETTINGS, ...result };
        setSettings(loadedSettings);
        
        // Apply theme immediately
        applyTheme(loadedSettings.theme);
        setIsLoaded(true);
      } catch (error) {
        console.error('[useSettings] Failed to load settings:', error);
        setIsLoaded(true);
      }
    };
    
    loadSettings();
  }, []);

  // Apply theme when it changes
  useEffect(() => {
    if (!isLoaded) return;
    
    applyTheme(settings.theme);
    return setupThemeListener(settings.theme);
  }, [settings.theme, isLoaded]);

  // Listen for storage changes (from other contexts like options page)
  useEffect(() => {
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      // Only respond to local storage changes
      if (areaName !== 'local') return;
      
      const updatedSettings = { ...settings };
      let hasChanges = false;
      
      for (const [key, change] of Object.entries(changes)) {
        if (key in DEFAULT_SETTINGS && change.newValue !== undefined) {
          (updatedSettings as any)[key] = change.newValue;
          hasChanges = true;
          
          // Apply theme immediately when changed from another context
          if (key === 'theme') {
            applyTheme(change.newValue);
          }
        }
      }
      
      if (hasChanges) {
        setSettings(updatedSettings);
      }
    };
    
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [settings]);

  const updateSetting = useCallback(async <K extends keyof Settings>(
    key: K, 
    value: Settings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    await chrome.storage.local.set({ [key]: value });
  }, []);

  const saveAllSettings = useCallback(async (newSettings: Settings) => {
    setSettings(newSettings);
    await chrome.storage.local.set(newSettings);
  }, []);

  return {
    settings,
    isLoaded,
    updateSetting,
    saveAllSettings,
    availableLanguages: AVAILABLE_LANGUAGES,
  };
}
