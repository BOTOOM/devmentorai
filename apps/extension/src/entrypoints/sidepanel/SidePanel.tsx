import { useState, useEffect, useCallback } from 'react';
import { Header } from '../../components/Header';
import { SessionSelector } from '../../components/SessionSelector';
import { ChatView } from '../../components/ChatView';
import { NewSessionModal } from '../../components/NewSessionModal';
import { HelpModal } from '../../components/HelpModal';
import { PageContextModal } from '../../components/PageContextModal';
import { useBackendConnection } from '../../hooks/useBackendConnection';
import { useSessions } from '../../hooks/useSessions';
import { useChat } from '../../hooks/useChat';
import { useSettings } from '../../hooks/useSettings';
import { useContextExtraction } from '../../hooks/useContextExtraction';
import type { Session, QuickAction, MessageContext, ImagePayload } from '@devmentorai/shared';

// Extend QuickAction to include tone variations
type ExtendedAction = QuickAction | `rewrite_${string}` | 'chat';

export function SidePanel() {
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);         // D.2
  const [showPageContextModal, setShowPageContextModal] = useState(false); // D.1
  const [contextModeEnabled, setContextModeEnabled] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    action: ExtendedAction;
    selectedText: string;
    pageUrl?: string;
    pageTitle?: string;
  } | null>(null);

  // B.1 - Apply theme via settings hook
  const { settings } = useSettings();

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

  // Context extraction hook
  const {
    extractedContext,
    platform,
    isExtracting: isExtractingContext,
    extractionError,
    extractContext,
    clearContext,
    errorCount,
    captureVisibleTabScreenshot,
  } = useContextExtraction();

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
    
    // Also listen for storage changes (for quick actions from toolbar)
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.pendingAction?.newValue) {
        setPendingAction(changes.pendingAction.newValue);
        chrome.storage.local.remove('pendingAction');
      }
    };
    
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  // Process pending action when we have an active session
  useEffect(() => {
    console.log('[SidePanel] Checking pending action:', {
      hasPendingAction: !!pendingAction,
      hasActiveSession: !!activeSession,
      connectionStatus,
      pendingAction: pendingAction?.action,
    });

    if (pendingAction && activeSession && connectionStatus === 'connected') {
      console.log('[SidePanel] Processing pending action:', pendingAction.action);
      
      const context: MessageContext = {
        selectedText: pendingAction.selectedText,
        pageUrl: pendingAction.pageUrl,
        pageTitle: pendingAction.pageTitle,
        action: pendingAction.action.startsWith('rewrite_') ? 'rewrite' : pendingAction.action as QuickAction,
      };

      // Get target language name for translation (B.3)
      const getLanguageName = (code: string) => {
        const languages: Record<string, string> = {
          en: 'English', es: 'Spanish', fr: 'French', de: 'German',
          pt: 'Portuguese', it: 'Italian', ja: 'Japanese', zh: 'Chinese',
          ko: 'Korean', ru: 'Russian',
        };
        return languages[code] || 'English';
      };
      const targetLanguage = getLanguageName(settings.translationLanguage);

      // Build prompt based on action
      let prompt: string;
      
      if (pendingAction.action === 'chat') {
        // Just open chat with context, user will type
        console.log('[SidePanel] Chat action, clearing pending');
        setPendingAction(null);
        return;
      } else if (pendingAction.action.startsWith('rewrite_')) {
        const tone = pendingAction.action.replace('rewrite_', '');
        prompt = `Rewrite the following text in a ${tone} tone:\n\n${pendingAction.selectedText}`;
      } else {
        const actionPrompts: Record<QuickAction, string> = {
          explain: 'Explain the following:\n\n',
          translate: `Translate the following to ${targetLanguage}:\n\n`,
          rewrite: 'Rewrite the following for clarity and improved style:\n\n',
          fix_grammar: 'Fix the grammar and spelling in the following:\n\n',
          summarize: 'Summarize the following:\n\n',
          expand: 'Expand on the following with more details:\n\n',
          analyze_config: 'Analyze the following configuration for best practices and potential issues:\n\n',
          diagnose_error: 'Diagnose the following error and suggest solutions:\n\n',
        };
        prompt = actionPrompts[pendingAction.action as QuickAction] + pendingAction.selectedText;
      }

      console.log('[SidePanel] Sending message with prompt length:', prompt.length);
      sendMessage(prompt, context);
      setPendingAction(null);
    }
  }, [pendingAction, activeSession, connectionStatus, sendMessage, settings.translationLanguage]);

  const handleSendMessage = useCallback(async (content: string, useContext?: boolean, images?: ImagePayload[]) => {
    if (useContext && activeSession?.id) {
      // Extract context and send with full context payload
      console.log('[SidePanel] Context mode enabled, extracting context...');
      const aggregatedContext = await extractContext(activeSession.id, content);
      
      if (aggregatedContext) {
        console.log('[SidePanel] Context extracted, sending with full context');
        sendMessage(content, {
          fullContext: aggregatedContext,
          useContextAwareMode: true,
          images,
        });
      } else {
        // Fallback to regular send if context extraction fails
        console.log('[SidePanel] Context extraction failed, sending without context');
        sendMessage(content, { images });
      }
    } else {
      sendMessage(content, { images });
    }
  }, [sendMessage, extractContext, activeSession?.id]);

  // Toggle context mode and extract context if enabling
  const handleToggleContextMode = useCallback(async () => {
    const newState = !contextModeEnabled;
    setContextModeEnabled(newState);
    
    if (newState && activeSession?.id) {
      // Extract context when enabling
      await extractContext(activeSession.id);
    } else {
      // Clear context when disabling
      clearContext();
    }
  }, [contextModeEnabled, activeSession?.id, extractContext, clearContext]);

  const handleNewSession = useCallback(async (name: string, type: Session['type'], model?: string) => {
    await createSession(name, type, model);
    setShowNewSessionModal(false);
  }, [createSession]);

  // D.1 - Handle using page context in chat
  const handleUsePageContext = useCallback((context: { url: string; title: string; selectedText?: string }) => {
    const contextText = context.selectedText 
      ? `About this page (${context.title}):\nURL: ${context.url}\n\nSelected text:\n"${context.selectedText}"\n\n`
      : `About this page (${context.title}):\nURL: ${context.url}\n\n`;
    
    // Set as pending text for the chat input
    setPendingAction({
      action: 'chat',
      selectedText: contextText,
      pageUrl: context.url,
      pageTitle: context.title,
    });
  }, []);

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
        onOpenSettings={() => chrome.runtime.openOptionsPage()}
        onOpenHelp={() => setShowHelpModal(true)}
        onViewPage={() => setShowPageContextModal(true)}
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
        pendingText={pendingAction?.action === 'chat' ? pendingAction.selectedText : undefined}
        // Context-aware mode props
        contextEnabled={contextModeEnabled}
        onToggleContext={handleToggleContextMode}
        isExtractingContext={isExtractingContext}
        extractedContext={extractedContext}
        platform={platform}
        errorCount={errorCount}
        // Image attachment props
        imageAttachmentsEnabled={settings.imageAttachmentsEnabled}
        screenshotBehavior={settings.screenshotBehavior}
        onCaptureScreenshot={captureVisibleTabScreenshot}
      />

      {showNewSessionModal && (
        <NewSessionModal
          onClose={() => setShowNewSessionModal(false)}
          onSubmit={handleNewSession}
        />
      )}

      {showHelpModal && (
        <HelpModal onClose={() => setShowHelpModal(false)} />
      )}

      {showPageContextModal && (
        <PageContextModal 
          onClose={() => setShowPageContextModal(false)} 
          onUseInChat={handleUsePageContext}
        />
      )}
    </div>
  );
}
