import { useState, useEffect, useCallback } from 'react';
import { Header } from '../../components/Header';
import { SessionSelector } from '../../components/SessionSelector';
import { ChatView } from '../../components/ChatView';
import { NewSessionModal } from '../../components/NewSessionModal';
import { useBackendConnection } from '../../hooks/useBackendConnection';
import { useSessions } from '../../hooks/useSessions';
import { useChat } from '../../hooks/useChat';
import type { Session, QuickAction, MessageContext } from '@devmentorai/shared';

export function SidePanel() {
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    action: QuickAction;
    selectedText: string;
    pageUrl?: string;
    pageTitle?: string;
  } | null>(null);

  const { status: connectionStatus, error: connectionError } = useBackendConnection();
  const {
    sessions,
    activeSession,
    isLoading: sessionsLoading,
    createSession,
    selectSession,
    deleteSession,
  } = useSessions();
  
  const {
    messages,
    isStreaming,
    sendMessage,
    abortMessage,
  } = useChat(activeSession?.id);

  // Check for pending actions from context menu
  useEffect(() => {
    const checkPendingAction = async () => {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_PENDING_ACTION' });
        if (response && response.action && response.selectedText) {
          setPendingAction(response);
        }
      } catch (error) {
        console.error('[SidePanel] Failed to get pending action:', error);
      }
    };

    checkPendingAction();
  }, []);

  // Process pending action when we have an active session
  useEffect(() => {
    if (pendingAction && activeSession && connectionStatus === 'connected') {
      const context: MessageContext = {
        selectedText: pendingAction.selectedText,
        pageUrl: pendingAction.pageUrl,
        pageTitle: pendingAction.pageTitle,
        action: pendingAction.action,
      };

      const actionPrompts: Record<QuickAction, string> = {
        explain: 'Explain the following:\n\n',
        translate: 'Translate the following to English (or to the user\'s language if already in English):\n\n',
        rewrite: 'Rewrite the following for clarity and improved style:\n\n',
        fix_grammar: 'Fix the grammar and spelling in the following:\n\n',
        summarize: 'Summarize the following:\n\n',
        expand: 'Expand on the following with more details:\n\n',
        analyze_config: 'Analyze the following configuration for best practices and potential issues:\n\n',
        diagnose_error: 'Diagnose the following error and suggest solutions:\n\n',
      };

      const prompt = actionPrompts[pendingAction.action] + pendingAction.selectedText;
      sendMessage(prompt, context);
      setPendingAction(null);
    }
  }, [pendingAction, activeSession, connectionStatus, sendMessage]);

  const handleSendMessage = useCallback((content: string) => {
    sendMessage(content);
  }, [sendMessage]);

  const handleNewSession = useCallback(async (name: string, type: Session['type']) => {
    await createSession(name, type);
    setShowNewSessionModal(false);
  }, [createSession]);

  // Show loading state
  if (sessionsLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      <Header
        connectionStatus={connectionStatus}
        onNewSession={() => setShowNewSessionModal(true)}
      />

      {connectionError && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{connectionError}</p>
        </div>
      )}

      <SessionSelector
        sessions={sessions}
        activeSessionId={activeSession?.id}
        onSelectSession={selectSession}
        onDeleteSession={deleteSession}
      />

      <ChatView
        session={activeSession}
        messages={messages}
        isStreaming={isStreaming}
        onSendMessage={handleSendMessage}
        onAbort={abortMessage}
        disabled={connectionStatus !== 'connected'}
      />

      {showNewSessionModal && (
        <NewSessionModal
          onClose={() => setShowNewSessionModal(false)}
          onSubmit={handleNewSession}
        />
      )}
    </div>
  );
}
