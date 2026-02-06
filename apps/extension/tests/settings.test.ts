/**
 * Unit tests for useSettings hook and settings utilities
 * Tests settings validation, defaults, and storage
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_SETTINGS, AVAILABLE_LANGUAGES, type Settings } from '../src/hooks/useSettings';

describe('Settings', () => {
  describe('DEFAULT_SETTINGS', () => {
    it('should have all required properties', () => {
      expect(DEFAULT_SETTINGS).toHaveProperty('theme');
      expect(DEFAULT_SETTINGS).toHaveProperty('floatingBubbleEnabled');
      expect(DEFAULT_SETTINGS).toHaveProperty('showSelectionToolbar');
      expect(DEFAULT_SETTINGS).toHaveProperty('defaultSessionType');
      expect(DEFAULT_SETTINGS).toHaveProperty('language');
      expect(DEFAULT_SETTINGS).toHaveProperty('translationLanguage');
      expect(DEFAULT_SETTINGS).toHaveProperty('targetTranslationLanguage');
      expect(DEFAULT_SETTINGS).toHaveProperty('backendUrl');
      expect(DEFAULT_SETTINGS).toHaveProperty('communicationMode');
      expect(DEFAULT_SETTINGS).toHaveProperty('screenshotBehavior');
      expect(DEFAULT_SETTINGS).toHaveProperty('imageAttachmentsEnabled');
      expect(DEFAULT_SETTINGS).toHaveProperty('textReplacementBehavior');
      expect(DEFAULT_SETTINGS).toHaveProperty('quickActionModel');
    });

    it('should have valid theme value', () => {
      expect(['light', 'dark', 'system']).toContain(DEFAULT_SETTINGS.theme);
    });

    it('should have valid session type', () => {
      expect(['devops', 'writing', 'development', 'general']).toContain(DEFAULT_SETTINGS.defaultSessionType);
    });

    it('should have valid communication mode', () => {
      expect(['http', 'native']).toContain(DEFAULT_SETTINGS.communicationMode);
    });

    it('should have valid screenshot behavior', () => {
      expect(['disabled', 'ask', 'auto']).toContain(DEFAULT_SETTINGS.screenshotBehavior);
    });

    it('should have valid text replacement behavior', () => {
      expect(['ask', 'auto', 'never']).toContain(DEFAULT_SETTINGS.textReplacementBehavior);
    });

    it('should have valid backend URL format', () => {
      expect(DEFAULT_SETTINGS.backendUrl).toMatch(/^https?:\/\/.+/);
    });

    it('should have boolean values for toggle settings', () => {
      expect(typeof DEFAULT_SETTINGS.floatingBubbleEnabled).toBe('boolean');
      expect(typeof DEFAULT_SETTINGS.showSelectionToolbar).toBe('boolean');
      expect(typeof DEFAULT_SETTINGS.imageAttachmentsEnabled).toBe('boolean');
    });

    it('should have string values for text settings', () => {
      expect(typeof DEFAULT_SETTINGS.language).toBe('string');
      expect(typeof DEFAULT_SETTINGS.translationLanguage).toBe('string');
      expect(typeof DEFAULT_SETTINGS.targetTranslationLanguage).toBe('string');
      expect(typeof DEFAULT_SETTINGS.quickActionModel).toBe('string');
    });
  });

  describe('AVAILABLE_LANGUAGES', () => {
    it('should be an array of languages', () => {
      expect(Array.isArray(AVAILABLE_LANGUAGES)).toBe(true);
      expect(AVAILABLE_LANGUAGES.length).toBeGreaterThan(0);
    });

    it('should have code and name for each language', () => {
      for (const lang of AVAILABLE_LANGUAGES) {
        expect(lang).toHaveProperty('code');
        expect(lang).toHaveProperty('name');
        expect(typeof lang.code).toBe('string');
        expect(typeof lang.name).toBe('string');
      }
    });

    it('should include English', () => {
      const english = AVAILABLE_LANGUAGES.find(l => l.code === 'en');
      expect(english).toBeDefined();
      expect(english?.name).toBe('English');
    });

    it('should include Spanish', () => {
      const spanish = AVAILABLE_LANGUAGES.find(l => l.code === 'es');
      expect(spanish).toBeDefined();
      expect(spanish?.name).toBe('Español');
    });

    it('should have unique language codes', () => {
      const codes = AVAILABLE_LANGUAGES.map(l => l.code);
      const uniqueCodes = new Set(codes);
      expect(codes.length).toBe(uniqueCodes.size);
    });

    it('should have valid ISO language codes (2 chars)', () => {
      for (const lang of AVAILABLE_LANGUAGES) {
        expect(lang.code.length).toBe(2);
        expect(lang.code).toMatch(/^[a-z]{2}$/);
      }
    });
  });

  describe('Settings Type Validation', () => {
    it('should allow valid settings object', () => {
      const validSettings: Settings = {
        theme: 'dark',
        floatingBubbleEnabled: true,
        showSelectionToolbar: false,
        defaultSessionType: 'writing',
        language: 'es',
        translationLanguage: 'fr',
        targetTranslationLanguage: 'de',
        backendUrl: 'http://localhost:4000',
        communicationMode: 'http',
        screenshotBehavior: 'auto',
        imageAttachmentsEnabled: true,
        textReplacementBehavior: 'auto',
        quickActionModel: 'gpt-4o',
      };

      // Type check passes if this compiles
      expect(validSettings.theme).toBe('dark');
      expect(validSettings.defaultSessionType).toBe('writing');
    });

    it('should merge partial settings with defaults', () => {
      const partialSettings = {
        theme: 'dark' as const,
        language: 'fr',
      };

      const merged: Settings = { ...DEFAULT_SETTINGS, ...partialSettings };
      
      expect(merged.theme).toBe('dark');
      expect(merged.language).toBe('fr');
      expect(merged.floatingBubbleEnabled).toBe(DEFAULT_SETTINGS.floatingBubbleEnabled);
      expect(merged.backendUrl).toBe(DEFAULT_SETTINGS.backendUrl);
    });
  });

  describe('Settings Validation Helpers', () => {
    // Helper functions that could be extracted
    const isValidTheme = (theme: string): theme is Settings['theme'] => {
      return ['light', 'dark', 'system'].includes(theme);
    };

    const isValidSessionType = (type: string): type is Settings['defaultSessionType'] => {
      return ['devops', 'writing', 'development', 'general'].includes(type);
    };

    const isValidCommunicationMode = (mode: string): mode is Settings['communicationMode'] => {
      return ['http', 'native'].includes(mode);
    };

    const isValidScreenshotBehavior = (behavior: string): behavior is Settings['screenshotBehavior'] => {
      return ['disabled', 'ask', 'auto'].includes(behavior);
    };

    const isValidTextReplacementBehavior = (behavior: string): behavior is Settings['textReplacementBehavior'] => {
      return ['ask', 'auto', 'never'].includes(behavior);
    };

    it('should validate theme values', () => {
      expect(isValidTheme('light')).toBe(true);
      expect(isValidTheme('dark')).toBe(true);
      expect(isValidTheme('system')).toBe(true);
      expect(isValidTheme('invalid')).toBe(false);
      expect(isValidTheme('')).toBe(false);
    });

    it('should validate session type values', () => {
      expect(isValidSessionType('devops')).toBe(true);
      expect(isValidSessionType('writing')).toBe(true);
      expect(isValidSessionType('development')).toBe(true);
      expect(isValidSessionType('general')).toBe(true);
      expect(isValidSessionType('invalid')).toBe(false);
    });

    it('should validate communication mode values', () => {
      expect(isValidCommunicationMode('http')).toBe(true);
      expect(isValidCommunicationMode('native')).toBe(true);
      expect(isValidCommunicationMode('websocket')).toBe(false);
    });

    it('should validate screenshot behavior values', () => {
      expect(isValidScreenshotBehavior('disabled')).toBe(true);
      expect(isValidScreenshotBehavior('ask')).toBe(true);
      expect(isValidScreenshotBehavior('auto')).toBe(true);
      expect(isValidScreenshotBehavior('always')).toBe(false);
    });

    it('should validate text replacement behavior values', () => {
      expect(isValidTextReplacementBehavior('ask')).toBe(true);
      expect(isValidTextReplacementBehavior('auto')).toBe(true);
      expect(isValidTextReplacementBehavior('never')).toBe(true);
      expect(isValidTextReplacementBehavior('always')).toBe(false);
    });
  });

  describe('Backend URL Validation', () => {
    const isValidBackendUrl = (url: string): boolean => {
      try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    };

    it('should validate HTTP URLs', () => {
      expect(isValidBackendUrl('http://localhost:3847')).toBe(true);
      expect(isValidBackendUrl('http://127.0.0.1:3000')).toBe(true);
      expect(isValidBackendUrl('http://example.com')).toBe(true);
    });

    it('should validate HTTPS URLs', () => {
      expect(isValidBackendUrl('https://api.example.com')).toBe(true);
      expect(isValidBackendUrl('https://api.example.com:8443')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidBackendUrl('not-a-url')).toBe(false);
      expect(isValidBackendUrl('ftp://example.com')).toBe(false);
      expect(isValidBackendUrl('')).toBe(false);
      expect(isValidBackendUrl('localhost:3000')).toBe(false); // missing protocol
    });
  });

  describe('Language Selection', () => {
    const findLanguageByCode = (code: string) => {
      return AVAILABLE_LANGUAGES.find(l => l.code === code);
    };

    const getLanguageName = (code: string): string => {
      return findLanguageByCode(code)?.name || code;
    };

    it('should find language by code', () => {
      expect(findLanguageByCode('en')?.name).toBe('English');
      expect(findLanguageByCode('ja')?.name).toBe('日本語');
      expect(findLanguageByCode('zh')?.name).toBe('中文');
    });

    it('should return undefined for unknown language', () => {
      expect(findLanguageByCode('xx')).toBeUndefined();
    });

    it('should get language name or fallback to code', () => {
      expect(getLanguageName('en')).toBe('English');
      expect(getLanguageName('xx')).toBe('xx');
    });
  });
});
