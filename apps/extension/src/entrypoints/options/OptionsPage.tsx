import { useState, useEffect } from 'react';

interface Settings {
  theme: 'light' | 'dark' | 'system';
  floatingBubbleEnabled: boolean;
  showSelectionToolbar: boolean;
  defaultSessionType: 'devops' | 'writing' | 'development' | 'general';
  language: string;
  backendUrl: string;
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  floatingBubbleEnabled: false,
  showSelectionToolbar: true,
  defaultSessionType: 'devops',
  language: 'en',
  backendUrl: 'http://localhost:3847',
};

export function OptionsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  useEffect(() => {
    loadSettings();
    checkBackendConnection();
  }, []);

  const loadSettings = async () => {
    const result = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
    setSettings({ ...DEFAULT_SETTINGS, ...result });
  };

  const saveSettings = async () => {
    await chrome.storage.local.set(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const checkBackendConnection = async () => {
    try {
      const response = await fetch(`${settings.backendUrl}/api/health`);
      if (response.ok) {
        setBackendStatus('connected');
      } else {
        setBackendStatus('disconnected');
      }
    } catch {
      setBackendStatus('disconnected');
    }
  };

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

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
              value={settings.backendUrl}
              onChange={(e) => updateSetting('backendUrl', e.target.value)}
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
                    onClick={() => updateSetting('theme', theme)}
                    className={`flex-1 py-2 px-4 rounded-lg border transition-colors ${
                      settings.theme === theme
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
                Language
              </label>
              <select
                value={settings.language}
                onChange={(e) => updateSetting('language', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </div>
          </div>
        </div>

        {/* Behavior */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Behavior</h2>
          
          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-gray-700 dark:text-gray-300">Floating Bubble</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">Show floating bubble on all pages</p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={settings.floatingBubbleEnabled}
                  onChange={(e) => updateSetting('floatingBubbleEnabled', e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-11 h-6 rounded-full transition-colors ${
                  settings.floatingBubbleEnabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                }`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                    settings.floatingBubbleEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  } mt-0.5`} />
                </div>
              </div>
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <span className="text-gray-700 dark:text-gray-300">Selection Toolbar</span>
                <p className="text-sm text-gray-500 dark:text-gray-400">Show toolbar when selecting text</p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={settings.showSelectionToolbar}
                  onChange={(e) => updateSetting('showSelectionToolbar', e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-11 h-6 rounded-full transition-colors ${
                  settings.showSelectionToolbar ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                }`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                    settings.showSelectionToolbar ? 'translate-x-5' : 'translate-x-0.5'
                  } mt-0.5`} />
                </div>
              </div>
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default Session Type
              </label>
              <select
                value={settings.defaultSessionType}
                onChange={(e) => updateSetting('defaultSessionType', e.target.value as Settings['defaultSessionType'])}
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
