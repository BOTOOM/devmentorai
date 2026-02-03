import { useState, useEffect } from 'react';
import { useSettings, DEFAULT_SETTINGS, AVAILABLE_LANGUAGES, type Settings } from '../../hooks/useSettings';

export function OptionsPage() {
  const { settings, isLoaded, updateSetting, saveAllSettings } = useSettings();
  const [localSettings, setLocalSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  // Sync local settings with loaded settings
  useEffect(() => {
    if (isLoaded) {
      setLocalSettings(settings);
    }
  }, [settings, isLoaded]);

  useEffect(() => {
    if (isLoaded) {
      checkBackendConnection();
    }
  }, [isLoaded, localSettings.backendUrl]);

  const saveSettings = async () => {
    await saveAllSettings(localSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const checkBackendConnection = async () => {
    try {
      const response = await fetch(`${localSettings.backendUrl}/api/health`);
      if (response.ok) {
        setBackendStatus('connected');
      } else {
        setBackendStatus('disconnected');
      }
    } catch {
      setBackendStatus('disconnected');
    }
  };

  const updateLocalSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    
    // Apply theme immediately when changed (don't wait for Save)
    if (key === 'theme') {
      applyTheme(value as Settings['theme']);
      // Also save to storage immediately so other contexts can react
      chrome.storage.local.set({ theme: value });
    }
  };

  // Helper function to apply theme (same as in useSettings)
  const applyTheme = (theme: Settings['theme']) => {
    const root = document.documentElement;
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.toggle('dark', prefersDark);
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-indigo-500 flex items-center justify-center">
              <span className="text-white text-2xl font-bold">D</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">DevMentorAI</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Settings</p>
            </div>
          </div>
        </div>

        {/* Backend Status */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Backend Connection</h2>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                backendStatus === 'connected' ? 'bg-green-500' :
                backendStatus === 'disconnected' ? 'bg-red-500' :
                'bg-yellow-500 animate-pulse'
              }`} />
              <span className="text-gray-700 dark:text-gray-300">
                {backendStatus === 'connected' ? 'Connected' :
                 backendStatus === 'disconnected' ? 'Disconnected' :
                 'Checking...'}
              </span>
            </div>
            <button
              onClick={checkBackendConnection}
              className="text-sm text-primary hover:underline"
            >
              Test Connection
            </button>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Backend URL
            </label>
            <input
              type="text"
              value={localSettings.backendUrl}
              onChange={(e) => updateLocalSetting('backendUrl', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="http://localhost:3847"
            />
          </div>
        </div>

        {/* Appearance */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Appearance</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Theme
              </label>
              <div className="flex gap-2">
                {(['light', 'dark', 'system'] as const).map((theme) => (
                  <button
                    key={theme}
                    onClick={() => updateLocalSetting('theme', theme)}
                    className={`flex-1 py-2 px-4 rounded-lg border transition-colors ${
                      localSettings.theme === theme
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-primary'
                    }`}
                  >
                    {theme === 'light' && '☀️ Light'}
                    {theme === 'dark' && '🌙 Dark'}
                    {theme === 'system' && '💻 System'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Interface Language
              </label>
              <select
                value={localSettings.language}
                onChange={(e) => updateLocalSetting('language', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {AVAILABLE_LANGUAGES.filter(l => ['en', 'es'].includes(l.code)).map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ⚠️ Chrome extensions use the browser's language setting. To change the UI language, 
                go to Chrome Settings → Languages and set your preferred language as default.
              </p>
            </div>

            {/* B.3 - Translation target language */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Translation Target Language
              </label>
              <select
                value={localSettings.translationLanguage}
                onChange={(e) => updateLocalSetting('translationLanguage', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {AVAILABLE_LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Default language for text translations
              </p>
            </div>
          </div>
        </div>

        {/* Behavior */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Behavior</h2>
          
          <div className="space-y-4">
            {/* <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-gray-700 dark:text-gray-300">Floating Bubble</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">Show floating bubble on all pages</p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={localSettings.floatingBubbleEnabled}
                  onChange={(e) => updateLocalSetting('floatingBubbleEnabled', e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-11 h-6 rounded-full transition-colors ${
                  localSettings.floatingBubbleEnabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                }`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                    localSettings.floatingBubbleEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  } mt-0.5`} />
                </div>
              </div>
            </label> */}

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-gray-700 dark:text-gray-300">Selection Toolbar</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">Show toolbar when selecting text</p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={localSettings.showSelectionToolbar}
                  onChange={(e) => updateLocalSetting('showSelectionToolbar', e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-11 h-6 rounded-full transition-colors ${
                  localSettings.showSelectionToolbar ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                }`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                    localSettings.showSelectionToolbar ? 'translate-x-5' : 'translate-x-0.5'
                  } mt-0.5`} />
                </div>
              </div>
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default Session Type
              </label>
              <select
                value={localSettings.defaultSessionType}
                onChange={(e) => updateLocalSetting('defaultSessionType', e.target.value as Settings['defaultSessionType'])}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="devops">🔧 DevOps Mentor</option>
                <option value="writing">✍️ Writing Assistant</option>
                <option value="development">💻 Development Helper</option>
                <option value="general">🤖 General Assistant</option>
              </select>
            </div>
          </div>
        </div>

        {/* Image & Screenshots */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Images & Screenshots</h2>
          
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-gray-700 dark:text-gray-300">Image Attachments</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">Allow pasting and dragging images into chat</p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={localSettings.imageAttachmentsEnabled}
                  onChange={(e) => updateLocalSetting('imageAttachmentsEnabled', e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-11 h-6 rounded-full transition-colors ${
                  localSettings.imageAttachmentsEnabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                }`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                    localSettings.imageAttachmentsEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  } mt-0.5`} />
                </div>
              </div>
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Screenshot Behavior (Context Mode)
              </label>
              <div className="flex gap-2">
                {(['disabled', 'ask', 'auto'] as const).map((behavior) => (
                  <button
                    key={behavior}
                    onClick={() => updateLocalSetting('screenshotBehavior', behavior)}
                    className={`flex-1 py-2 px-3 rounded-lg border transition-colors text-sm ${
                      localSettings.screenshotBehavior === behavior
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-primary'
                    }`}
                  >
                    {behavior === 'disabled' && '🚫 Disabled'}
                    {behavior === 'ask' && '❓ Ask'}
                    {behavior === 'auto' && '📸 Auto'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {localSettings.screenshotBehavior === 'disabled' 
                  ? 'Screenshots are not captured automatically'
                  : localSettings.screenshotBehavior === 'ask'
                    ? 'Ask before capturing screenshot when context mode is enabled'
                    : 'Automatically capture screenshot when context mode is enabled'}
              </p>
            </div>
          </div>
        </div>

        {/* Advanced Settings - C.3 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Advanced</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Communication Mode
              </label>
              <div className="flex gap-2">
                {(['http', 'native'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => updateLocalSetting('communicationMode', mode)}
                    className={`flex-1 py-2 px-4 rounded-lg border transition-colors ${
                      localSettings.communicationMode === mode
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-primary'
                    }`}
                  >
                    {mode === 'http' && '🌐 HTTP Server'}
                    {mode === 'native' && '⚡ Native Messaging'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {localSettings.communicationMode === 'http' 
                  ? 'Uses local HTTP server (requires backend running)'
                  : 'Uses Native Messaging (requires native host installed)'}
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          {saved && (
            <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
              ✓ Settings saved
            </span>
          )}
          <button
            onClick={saveSettings}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            Save Settings
          </button>
        </div>

        {/* About */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            DevMentorAI v0.1.0 • Powered by GitHub Copilot
          </p>
        </div>
      </div>
    </div>
  );
}
