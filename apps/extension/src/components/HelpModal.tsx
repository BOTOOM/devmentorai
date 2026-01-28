import { X, Keyboard, MessageCircle, Globe, Palette, HelpCircle } from 'lucide-react';

interface HelpModalProps {
  onClose: () => void;
}

export function HelpModal({ onClose }: HelpModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Help & Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Quick Overview */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              What is DevMentorAI?
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              DevMentorAI is your AI-powered assistant for DevOps mentoring, writing assistance, 
              and development help. It uses GitHub Copilot to provide intelligent responses 
              tailored to your needs.
            </p>
          </section>

          {/* Session Types */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Session Types
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-lg">🔧</span>
                <div>
                  <strong className="text-gray-900 dark:text-white">DevOps Mentor:</strong>
                  <span className="text-gray-600 dark:text-gray-400"> AWS, Azure, GCP, Kubernetes, CI/CD, Infrastructure</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-lg">✍️</span>
                <div>
                  <strong className="text-gray-900 dark:text-white">Writing Assistant:</strong>
                  <span className="text-gray-600 dark:text-gray-400"> Email writing, translation, rewriting, grammar fixes</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-lg">💻</span>
                <div>
                  <strong className="text-gray-900 dark:text-white">Development Helper:</strong>
                  <span className="text-gray-600 dark:text-gray-400"> Code review, debugging, architecture decisions</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-lg">🤖</span>
                <div>
                  <strong className="text-gray-900 dark:text-white">General Assistant:</strong>
                  <span className="text-gray-600 dark:text-gray-400"> General purpose AI assistance</span>
                </div>
              </div>
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Keyboard className="w-4 h-4" />
              Keyboard Shortcuts
            </h3>
            <div className="space-y-2">
              {[
                { keys: ['Ctrl', 'Shift', 'D'], action: 'Open DevMentorAI' },
                { keys: ['Ctrl', 'Enter'], action: 'Send message' },
                { keys: ['Escape'], action: 'Close modals/Stop generation' },
                { keys: ['Ctrl', 'N'], action: 'New session (when in panel)' },
              ].map((shortcut, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{shortcut.action}</span>
                  <div className="flex gap-1">
                    {shortcut.keys.map((key, i) => (
                      <kbd
                        key={i}
                        className="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded"
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Quick Actions */}
          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Selection Toolbar
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Select text on any webpage to see quick actions:
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span>💡</span>
                <span className="text-gray-600 dark:text-gray-400">Explain</span>
              </div>
              <div className="flex items-center gap-2">
                <span>🌐</span>
                <span className="text-gray-600 dark:text-gray-400">Translate</span>
              </div>
              <div className="flex items-center gap-2">
                <span>✏️</span>
                <span className="text-gray-600 dark:text-gray-400">Rewrite</span>
              </div>
              <div className="flex items-center gap-2">
                <span>📝</span>
                <span className="text-gray-600 dark:text-gray-400">Fix Grammar</span>
              </div>
              <div className="flex items-center gap-2">
                <span>📄</span>
                <span className="text-gray-600 dark:text-gray-400">Summarize</span>
              </div>
              <div className="flex items-center gap-2">
                <span>🎨</span>
                <span className="text-gray-600 dark:text-gray-400">Change Tone</span>
              </div>
            </div>
          </section>

          {/* Version */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              DevMentorAI v0.1.0 • Powered by GitHub Copilot
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
