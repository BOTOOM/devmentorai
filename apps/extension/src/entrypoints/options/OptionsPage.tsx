import { useState, useEffect } from 'react';
import { useSettings, DEFAULT_SETTINGS, AVAILABLE_LANGUAGES, type Settings } from '../../hooks/useSettings';
import { useUpdateChecker } from '../../hooks/useUpdateChecker';
import { EXTENSION_VERSION } from '../../version.js';

export function OptionsPage() {
  const { settings, isLoaded, saveAllSettings } = useSettings();
  const { updateState, isChecking, hasAnyUpdate, checkNow } = useUpdateChecker();
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

            {/* Smart Translation Languages */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                  🌍 Smart Translation
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Translation automatically adapts based on context: translates to your native language when reading, 
                  and to your target language when writing in editable fields.
                </p>
              </div>
              
              {/* Native Language - for reading/understanding */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  📖 Native Language (for reading)
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
                  When you select text to read (non-editable), it translates to this language
                </p>
              </div>
              
              {/* Target Language - for writing/output */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  ✍️ Target Language (for writing)
                </label>
                <select
                  value={localSettings.targetTranslationLanguage}
                  onChange={(e) => updateLocalSetting('targetTranslationLanguage', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {AVAILABLE_LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>{lang.name}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  When you select text in an editable field, it translates to this language for replacement
                </p>
              </div>
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

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Text Replacement Behavior
              </label>
              <div className="flex gap-2">
                {(['ask', 'auto', 'never'] as const).map((behavior) => (
                  <button
                    key={behavior}
                    onClick={() => updateLocalSetting('textReplacementBehavior', behavior)}
                    className={`flex-1 py-2 px-3 rounded-lg border transition-colors text-sm ${
                      localSettings.textReplacementBehavior === behavior
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-primary'
                    }`}
                  >
                    {behavior === 'ask' && '❓ Ask'}
                    {behavior === 'auto' && '⚡ Auto'}
                    {behavior === 'never' && '📋 Copy Only'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {localSettings.textReplacementBehavior === 'ask' 
                  ? 'Show Replace/Copy options after AI response'
                  : localSettings.textReplacementBehavior === 'auto'
                    ? 'Automatically replace text in editable fields'
                    : 'Only copy AI results to clipboard (no replacement)'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Quick Action Model
              </label>
              <select
                value={localSettings.quickActionModel}
                onChange={(e) => updateLocalSetting('quickActionModel', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="gpt-4.1">GPT-4.1 (Fast)</option>
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                <option value="claude-3-5-haiku">Claude 3.5 Haiku (Fast)</option>
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Model used for quick actions like grammar fix, rewrite, translate
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
            className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium shadow-sm"
          >
            Save Settings
          </button>
        </div>

        {/* Support & Help */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Support & Help</h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Having issues or found a bug? We'd love to hear from you!
                </p>
                
                <a
                  href="https://github.com/BOTOOM/devmentorai/issues/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors font-medium shadow-sm"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                  </svg>
                  Report an Issue
                </a>

                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-300 font-medium mb-1">💡 Quick Tips</p>
                  <ul className="text-xs text-blue-700 dark:text-blue-400 space-y-1 ml-4">
                    <li>• Check if the backend server is running</li>
                    <li>• Verify your GitHub Copilot CLI is logged in</li>
                    <li>• Try refreshing the extension or browser</li>
                    <li>• Include error messages in your report</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* About & Updates */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">About & Updates</h2>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">Extension version</span>
                <span className="text-sm font-mono text-gray-900 dark:text-white">{EXTENSION_VERSION}</span>
              </div>

              {updateState?.backend && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Backend version</span>
                  <span className="text-sm font-mono text-gray-900 dark:text-white">
                    {updateState.backend.currentVersion}
                  </span>
                </div>
              )}

              {updateState?.extension?.hasUpdate && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    🔄 Extension v{updateState.extension.latestVersion} is available
                  </p>
                  <a
                    href={updateState.extension.releaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-amber-600 dark:text-amber-400 underline hover:text-amber-500"
                  >
                    Download from GitHub Releases
                  </a>
                </div>
              )}

              {updateState?.backend?.hasUpdate && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    🔄 Backend v{updateState.backend.latestVersion} is available
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-mono">
                    npx devmentorai-server@latest
                  </p>
                </div>
              )}

              {!hasAnyUpdate && updateState && (
                <p className="text-sm text-green-600 dark:text-green-400">✓ Everything is up to date</p>
              )}

              <button
                onClick={checkNow}
                disabled={isChecking}
                className="text-sm text-primary hover:underline disabled:opacity-50"
              >
                {isChecking ? 'Checking...' : 'Check for updates'}
              </button>

              {updateState?.lastChecked && (
                <p className="text-xs text-gray-400">
                  Last checked: {new Date(updateState.lastChecked).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            DevMentorAI v{EXTENSION_VERSION} • Powered by GitHub Copilot
          </p>
        </div>
      </div>
    </div>
  );
}
