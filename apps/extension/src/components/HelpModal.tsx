import { X, MessageCircle, Globe, Palette, HelpCircle } from 'lucide-react';
import { EXTENSION_VERSION } from '../version.js';

interface HelpModalProps {
  onClose: () => void;
}

export function HelpModal({ onClose }: Readonly<HelpModalProps>) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close help modal"
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
              Help
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
          {/* <section>
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
          </section> */}

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

          {/* Version & Support */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
            <div className="text-center">
              <a
                href="https://github.com/BOTOOM/devmentorai/issues/new"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                </svg>
                Found a bug? Report an issue
              </a>
            </div>
            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              DevMentorAI v{EXTENSION_VERSION} • Created by Edwar Diaz • {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
