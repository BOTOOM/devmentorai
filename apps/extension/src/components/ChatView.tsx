import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Square, Loader2, Cpu, ChevronDown, ChevronRight, Brain, Sparkles, Globe, AlertTriangle, ImagePlus, Upload } from 'lucide-react';
import { cn } from '../lib/utils';
import { MessageBubble } from './MessageBubble';
import { ImageAttachmentZone } from './ImageAttachmentZone';
import { useImageAttachments } from '../hooks/useImageAttachments';
import { SUPPORTED_LLM_PROVIDERS, PROVIDER_DISPLAY, type Session, type Message, type ContextPayload, type PlatformDetection, type ImagePayload, type ModelInfo, type LLMProvider } from '@devmentorai/shared';

const PRICING_BADGES: Record<string, { label: string; color: string }> = {
  free: { label: 'Free', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  cheap: { label: 'Cheap', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  standard: { label: 'Standard', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  premium: { label: 'Premium', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
};

function getUnavailableMessage(providerId: LLMProvider): string {
  const display = PROVIDER_DISPLAY[providerId];

  if (providerId === 'copilot') {
    return chrome.i18n.getMessage('model_unavailable_copilot') || 'This option is disabled. Requires GitHub Copilot authentication.';
  }

  if (display.category === 'cloud') {
    return `${display.name}: ${chrome.i18n.getMessage('model_unavailable_api_key') || 'This option is disabled. Requires API Key. Configure in Settings.'}`;
  }

  if (display.category === 'local-server') {
    return `${display.name}: ${chrome.i18n.getMessage('model_unavailable_local') || 'This option is disabled. Requires local application running.'}`;
  }

  return `${display.name}: ${chrome.i18n.getMessage('model_unavailable_cli') || 'This option is disabled. Requires CLI installed and running.'}`;
}

interface ChatViewProps {
  session: Session | null;
  messages: Message[];
  isStreaming: boolean;
  isSending?: boolean;
  onSendMessage: (content: string, useContext?: boolean, images?: ImagePayload[]) => void;
  onAbort: () => void;
  onChangeModel?: (model: string) => void;
  availableModels?: ModelInfo[];
  disabled?: boolean;
  pendingText?: string;
  // Context-aware mode props
  contextEnabled?: boolean;
  onToggleContext?: () => void;
  isExtractingContext?: boolean;
  extractedContext?: ContextPayload | null;
  platform?: PlatformDetection | null;
  errorCount?: number;
  // Image attachment props
  imageAttachmentsEnabled?: boolean;
  onCaptureScreenshot?: (mode: 'visible') => Promise<string | null>;
  screenshotBehavior?: 'disabled' | 'ask' | 'auto';
  /** Callback to register the addImage function for external use */
  onRegisterAddImage?: (addImage: (dataUrl: string, source: 'screenshot') => Promise<void>) => void;
}

export function ChatView({
  session,
  messages,
  isStreaming,
  isSending = false,
  onSendMessage,
  onAbort,
  onChangeModel,
  availableModels = [],
  disabled = false,
  pendingText,
  // Context-aware mode
  contextEnabled = false,
  onToggleContext,
  isExtractingContext = false,
  extractedContext,
  platform,
  errorCount = 0,
  // Image attachments
  imageAttachmentsEnabled = true,
  onCaptureScreenshot,
  screenshotBehavior = 'disabled',
  onRegisterAddImage,
}: Readonly<ChatViewProps>) {
  const [input, setInput] = useState('');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [modelSearch, setModelSearch] = useState('');
  const [collapsedProviders, setCollapsedProviders] = useState<Partial<Record<LLMProvider, boolean>>>({});
  const [showContextPreview, setShowContextPreview] = useState(false);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const cursorSelectionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const pendingCursorPositionRef = useRef<number | null>(null);

  // Image attachments hook
  const {
    images,
    isAtLimit,
    remainingSlots,
    addImage,
    removeImage,
    clearImages,
    getImagesForSend,
    handlePaste,
    handleDrop,
    lastError,
    clearError,
  } = useImageAttachments();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when session changes
  useEffect(() => {
    if (session && !disabled) {
      inputRef.current?.focus();
    }
  }, [session, disabled]);

  // Register addImage function for external use (e.g., context mode screenshot)
  useEffect(() => {
    if (onRegisterAddImage) {
      const addImageWrapper = async (dataUrl: string, source: 'screenshot') => {
        await addImage(dataUrl, source);
      };
      onRegisterAddImage(addImageWrapper);
    }
  }, [onRegisterAddImage, addImage]);

  const updateCursorSelection = useCallback((textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;

    cursorSelectionRef.current = {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    };
  }, []);

  // Insert pending text when provided (without replacing existing draft)
  useEffect(() => {
    if (pendingText) {
      const maxLength = 50000;
      setInput((prev) => {
        const textToInsert = pendingText.length > maxLength ? pendingText.substring(0, maxLength) : pendingText;

        if (!prev) {
          pendingCursorPositionRef.current = textToInsert.length;
          return textToInsert;
        }

        const currentSelection = cursorSelectionRef.current;
        const safePosition = Math.max(0, Math.min(currentSelection.start, prev.length));
        const before = prev.slice(0, safePosition);
        const after = prev.slice(safePosition);
        const availableSpace = maxLength - before.length - after.length;
        const clippedText = availableSpace > 0 ? textToInsert.slice(0, availableSpace) : '';
        const nextValue = `${before}${clippedText}${after}`;

        pendingCursorPositionRef.current = before.length + clippedText.length;
        return nextValue;
      });

      requestAnimationFrame(() => {
        const textarea = inputRef.current;
        if (!textarea) return;

        textarea.focus();
        const cursorPosition = pendingCursorPositionRef.current ?? textarea.value.length;
        textarea.setSelectionRange(cursorPosition, cursorPosition);
        updateCursorSelection(textarea);
        pendingCursorPositionRef.current = null;
      });
    }
  }, [pendingText, updateCursorSelection]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    updateCursorSelection(e.currentTarget);
  };

  // Handle paste event for images
  const handleInputPaste = useCallback(async (e: React.ClipboardEvent) => {
    if (!imageAttachmentsEnabled) return;
    
    // Check if clipboard contains image data
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault(); // Prevent default paste behavior for images
        await handlePaste(e.nativeEvent as ClipboardEvent);
        return;
      }
    }
    // If no images, let default text paste happen
  }, [imageAttachmentsEnabled, handlePaste]);

  // Handle screenshot capture
  const handleCaptureScreenshot = useCallback(async (mode: 'visible') => {
    if (!onCaptureScreenshot || isAtLimit) return;
    
    setIsCapturingScreenshot(true);
    try {
      const dataUrl = await onCaptureScreenshot(mode);
      if (dataUrl) {
        await addImage(dataUrl, 'screenshot');
      }
    } catch (error) {
      console.error('[ChatView] Screenshot capture failed:', error);
    } finally {
      setIsCapturingScreenshot(false);
    }
  }, [onCaptureScreenshot, isAtLimit, addImage]);

  // Drag & drop state for form-level handling
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounterRef = useRef(0);

  // Handle drag events at form level
  const handleFormDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!imageAttachmentsEnabled || disabled || isStreaming) return;
    
    dragCounterRef.current++;
    if (e.dataTransfer?.types.includes('Files')) {
      setIsDraggingOver(true);
    }
  }, [imageAttachmentsEnabled, disabled, isStreaming]);

  const handleFormDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDraggingOver(false);
    }
  }, []);

  const handleFormDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleFormDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDraggingOver(false);
    
    if (!imageAttachmentsEnabled || disabled || isStreaming) return;
    
    // Use the handleDrop from useImageAttachments
    await handleDrop(e.nativeEvent as DragEvent);
  }, [imageAttachmentsEnabled, disabled, isStreaming, handleDrop]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled || isStreaming || isSending) return;
    
    // Allow sending with images even without text
    const hasContent = input.trim() || images.length > 0;
    if (!hasContent) return;

    // Get images for sending and clear them
    const imagesToSend = images.length > 0 ? getImagesForSend() : undefined;
    
    onSendMessage(input.trim(), contextEnabled, imagesToSend);
    setInput('');
    clearImages();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const getSessionIcon = (type: Session['type']) => {
    switch (type) {
      case 'devops': return '🔧';
      case 'writing': return '✍️';
      case 'development': return '💻';
      default: return '🤖';
    }
  };

  const normalizedQuery = modelSearch.trim().toLowerCase();
  const isSearching = normalizedQuery.length > 0;
  const filteredModels = normalizedQuery
    ? availableModels.filter((model) => {
        const searchSource = [
          model.id,
          model.name,
          model.provider,
          model.description || '',
        ]
          .join(' ')
          .toLowerCase();
        return searchSource.includes(normalizedQuery);
      })
    : availableModels;

  const currentProviderId = session?.provider;

  const isProviderCollapsed = (providerId: LLMProvider): boolean => {
    if (isSearching) {
      return false;
    }

    const storedValue = collapsedProviders[providerId];
    if (typeof storedValue === 'boolean') {
      return storedValue;
    }

    return providerId !== currentProviderId;
  };

  const toggleProvider = (providerId: LLMProvider) => {
    setCollapsedProviders((current) => ({
      ...current,
      [providerId]: !isProviderCollapsed(providerId),
    }));
  };

  const hasStartedChat = messages.length > 0;
  const canUseModelPicker = Boolean(onChangeModel) && !disabled && !isStreaming && !hasStartedChat;

  useEffect(() => {
    if (hasStartedChat && showModelPicker) {
      setShowModelPicker(false);
      setModelSearch('');
    }
  }, [hasStartedChat, showModelPicker]);

  let placeholderText = chrome.i18n.getMessage('placeholder_message') || 'Type a message...';
  if (contextEnabled) {
    placeholderText = chrome.i18n.getMessage('placeholder_context') || 'Ask about this page...';
  } else if (images.length > 0) {
    placeholderText = 'Add a message or send images...';
  }

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">🚀</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Welcome to DevMentorAI
          </h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-sm">
            Create a new session to start chatting with your AI assistant.
            Choose from DevOps, Writing, Development, or General assistance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Session info bar - C.1: clickeable model selector */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-sm">
          <span>{getSessionIcon(session.type)}</span>
          <span className="font-medium text-gray-700 dark:text-gray-300">{session.name}</span>
        </div>
        
        {/* Model selector */}
        <div className="relative">
          <button
            onClick={() => {
              if (canUseModelPicker) {
                setShowModelPicker(!showModelPicker);
              }
            }}
            disabled={!canUseModelPicker}
            className={cn(
              "flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors",
              canUseModelPicker
                ? "text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer"
                : "text-gray-400 dark:text-gray-500 cursor-default"
            )}
          >
            {!hasStartedChat && <Cpu className="w-3.5 h-3.5" />}
            <span>{session.model}</span>
            {!hasStartedChat && onChangeModel && <ChevronDown className="w-3 h-3" />}
          </button>
          
          {showModelPicker && canUseModelPicker && availableModels.length > 0 && (
            <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg min-w-[240px] max-h-72 overflow-y-auto">
              <div className="sticky top-0 px-2 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <input
                  type="text"
                  value={modelSearch}
                  onChange={(event) => setModelSearch(event.target.value)}
                  placeholder="Search models..."
                  className="w-full px-2.5 py-1.5 text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {filteredModels.length === 0 && (
                <p className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">No models found</p>
              )}

              {SUPPORTED_LLM_PROVIDERS.map((providerId) => {
                const providerModels = filteredModels.filter((m) => m.provider === providerId);
                if (providerModels.length === 0) return null;
                const display = PROVIDER_DISPLAY[providerId];
                const availableProviderModels = providerModels.filter((m) => m.available !== false);
                const hasAvailable = availableProviderModels.length > 0;
                const isCollapsed = isProviderCollapsed(providerId);

                return (
                  <div key={providerId}>
                    <button
                      type="button"
                      onClick={() => toggleProvider(providerId)}
                      className={cn(
                        'w-full px-2.5 py-1.5 border-y border-gray-200 dark:border-gray-700 flex items-center gap-1.5 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/70',
                        hasAvailable ? 'bg-gray-50 dark:bg-gray-900' : 'bg-gray-100 dark:bg-gray-900/60'
                      )}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                      )}
                      <span className="text-xs" aria-hidden>{display.icon}</span>
                      <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">
                        {display.name}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {providerModels.length}
                      </span>
                    </button>

                    {!isCollapsed && !hasAvailable && (
                      <div className="px-3 py-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-900/40">
                        {getUnavailableMessage(providerId)}
                      </div>
                    )}

                    {!isCollapsed && availableProviderModels.map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => {
                          onChangeModel?.(model.id);
                          setShowModelPicker(false);
                          setModelSearch('');
                        }}
                        className={cn(
                          'w-full px-3 py-2 text-left text-xs transition-colors',
                          'hover:bg-gray-100 dark:hover:bg-gray-700',
                          model.id === session.model && 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{model.name}</span>
                          {model.pricingTier && (
                            <span className={cn(
                              'text-[9px] px-1.5 py-0.5 rounded-full',
                              PRICING_BADGES[model.pricingTier]?.color || PRICING_BADGES.standard.color
                            )}>
                              {PRICING_BADGES[model.pricingTier]?.label || 'Standard'}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">{model.id}</div>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              Start a conversation by typing a message below.
            </p>
            {session.type === 'devops' && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-gray-400 dark:text-gray-500">Quick prompts:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {['Explain Kubernetes pods', 'Best practices for CI/CD', 'Debug AWS Lambda'].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setInput(prompt)}
                      className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {session.type === 'writing' && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-gray-400 dark:text-gray-500">Quick prompts:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {['Write a professional email', 'Translate to Spanish', 'Make this more formal'].map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => setInput(prompt)}
                      className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        
        {/* Sending indicator - shown when uploading images / initiating request */}
        {isSending && !isStreaming && (
          <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg border border-amber-100 dark:border-amber-800/50">
            <div className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-amber-600 dark:text-amber-400 animate-pulse" />
              <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
            </div>
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Sending your message...
            </span>
          </div>
        )}

        {/* C.4 - Enhanced thinking indicator */}
        {isStreaming && (
          <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-primary-50 to-indigo-50 dark:from-primary-900/20 dark:to-indigo-900/20 rounded-lg border border-primary-100 dark:border-primary-800/50">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary-600 dark:text-primary-400 animate-pulse" />
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
            <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
              {chrome.i18n.getMessage('status_thinking') || 'Thinking...'}
            </span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        onDragEnter={handleFormDragEnter}
        onDragLeave={handleFormDragLeave}
        onDragOver={handleFormDragOver}
        onDrop={handleFormDrop}
        className={cn(
          "border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800 relative",
          isDraggingOver && "ring-2 ring-primary-400 ring-inset"
        )}
      >
        {/* Drag overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 bg-primary-50/80 dark:bg-primary-900/50 flex items-center justify-center z-10 rounded-lg pointer-events-none">
            <div className="text-center">
              <ImagePlus className="w-10 h-10 mx-auto mb-2 text-primary-500" />
              <p className="text-sm font-medium text-primary-700 dark:text-primary-300">Drop images here</p>
            </div>
          </div>
        )}

        {/* Image attachment zone */}
        {imageAttachmentsEnabled && (
          <ImageAttachmentZone
            images={images}
            isAtLimit={isAtLimit}
            remainingSlots={remainingSlots}
            onRemoveImage={removeImage}
            onDrop={handleDrop}
            error={lastError}
            onClearError={clearError}
            enabled={imageAttachmentsEnabled && !disabled && !isStreaming}
            onCaptureScreenshot={screenshotBehavior === 'disabled' ? undefined : handleCaptureScreenshot}
            isCapturingScreenshot={isCapturingScreenshot}
            showScreenshotButton={screenshotBehavior !== 'disabled' && !!onCaptureScreenshot}
          />
        )}

        {/* Context preview bar (shows when context is enabled) */}
        {contextEnabled && extractedContext && (
          <div className="mb-3 p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="font-medium text-indigo-700 dark:text-indigo-300">
                  {platform?.specificProduct || platform?.type || 'Page Context'}
                </span>
                {platform && platform.confidence >= 0.7 && (
                  <span className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-800/50 text-indigo-600 dark:text-indigo-400 rounded text-[10px]">
                    {Math.round(platform.confidence * 100)}% match
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 rounded text-[10px]">
                    <AlertTriangle className="w-3 h-3" />
                    {errorCount} errors detected
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowContextPreview(!showContextPreview)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {showContextPreview ? 'Hide' : 'Preview'}
              </button>
            </div>
            
            {showContextPreview && (
              <div className="mt-2 pt-2 border-t border-indigo-200 dark:border-indigo-700 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                <div className="truncate">
                  <span className="font-medium">URL:</span> {extractedContext.page.url}
                </div>
                {extractedContext.text.selectedText && (
                  <div className="truncate">
                    <span className="font-medium">Selection:</span> {extractedContext.text.selectedText.substring(0, 100)}...
                  </div>
                )}
                {extractedContext.text.headings.length > 0 && (
                  <div className="truncate">
                    <span className="font-medium">Headings:</span> {extractedContext.text.headings.slice(0, 3).map(h => h.text).join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2" style={{ alignItems: 'stretch' }}>
          {/* Context toggle button */}
          {onToggleContext && (
            <button
              type="button"
              onClick={onToggleContext}
              disabled={isStreaming || isExtractingContext}
              className={cn(
                'flex items-center justify-center w-12 h-12 rounded-xl transition-all shrink-0',
                contextEnabled
                  ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600',
                (isStreaming || isExtractingContext) && 'opacity-50 cursor-not-allowed'
              )}
              title={contextEnabled 
                ? (chrome.i18n.getMessage('context_mode_on') || 'Context mode ON - Click to disable')
                : (chrome.i18n.getMessage('context_mode_off') || 'Use page context')}
            >
              {isExtractingContext ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Sparkles className={cn('w-5 h-5', contextEnabled && 'animate-pulse')} />
              )}
            </button>
          )}

          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onKeyUp={(e) => updateCursorSelection(e.currentTarget)}
              onSelect={(e) => updateCursorSelection(e.currentTarget)}
              onClick={(e) => updateCursorSelection(e.currentTarget)}
              onBlur={(e) => updateCursorSelection(e.currentTarget)}
              onPaste={handleInputPaste}
              placeholder={placeholderText}
              disabled={disabled || isStreaming || isSending}
              rows={1}
              className={cn(
                'w-full px-4 text-sm rounded-xl border resize-none',
                'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700',
                'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'max-h-32',
                contextEnabled && 'ring-1 ring-indigo-300 dark:ring-indigo-700',
                images.length > 0 && 'ring-1 ring-primary-300 dark:ring-primary-700'
              )}
              style={{
                height: '48px',
                minHeight: '48px',
                maxHeight: '128px',
                paddingTop: '12px',
                paddingBottom: '12px',
                lineHeight: '24px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Image attachment button (when no images yet) */}
          {imageAttachmentsEnabled && images.length === 0 && !isStreaming && (
            <button
              type="button"
              onClick={() => {
                // Create a hidden file input and trigger it
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/png,image/jpeg,image/webp';
                input.multiple = true;
                input.onchange = async (e) => {
                  const files = (e.target as HTMLInputElement).files;
                  if (files) {
                    for (const file of Array.from(files)) {
                      const reader = new FileReader();
                      reader.onload = async () => {
                        if (reader.result) {
                          await addImage(reader.result as string, 'drop');
                        }
                      };
                      reader.readAsDataURL(file);
                    }
                  }
                };
                input.click();
              }}
              disabled={disabled}
              className={cn(
                'flex items-center justify-center w-12 h-12 rounded-xl transition-colors shrink-0',
                'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
                'hover:bg-gray-200 dark:hover:bg-gray-600',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
              title="Attach images"
            >
              <ImagePlus className="w-5 h-5" />
            </button>
          )}

          {isStreaming || isSending ? (
            <button
              type="button"
              onClick={onAbort}
              className={cn(
                "flex items-center justify-center w-12 h-12 rounded-xl text-white transition-colors shrink-0",
                isStreaming ? "bg-red-500 hover:bg-red-600" : "bg-amber-500 hover:bg-amber-600"
              )}
              title={isStreaming ? "Stop" : "Cancel"}
            >
              {isSending && !isStreaming ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Square className="w-5 h-5" />
              )}
            </button>
          ) : (
            <button
              type="submit"
              disabled={(!input.trim() && images.length === 0) || disabled}
              className={cn(
                'flex items-center justify-center w-12 h-12 rounded-xl transition-colors shrink-0',
                (input.trim() || images.length > 0) && !disabled
                  ? 'bg-primary-600 hover:bg-primary-700 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              )}
              title={chrome.i18n.getMessage('btn_send') || 'Send'}
            >
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
        
        {/* Context mode indicator text */}
        {contextEnabled && (
          <div className="mt-2 text-[10px] text-center text-indigo-600 dark:text-indigo-400">
            {chrome.i18n.getMessage('context_mode_hint') || 'Context mode: AI will analyze the current page'}
          </div>
        )}

        {/* Image attachment hint */}
        {imageAttachmentsEnabled && !contextEnabled && images.length === 0 && (
          <div className="mt-2 text-[10px] text-center text-gray-400 dark:text-gray-500">
            Paste or drag images to attach
          </div>
        )}
      </form>
    </div>
  );
}
