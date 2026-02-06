/**
 * Selection context types for text replacement feature
 */

/** Type of element containing the selection */
export type SelectionElementType = 'input' | 'textarea' | 'contenteditable' | 'other';

/**
 * Context information about the current text selection
 * Used to determine if replacement is possible and how to perform it
 */
export interface SelectionContext {
  /** The selected text content */
  selectedText: string;
  /** Type of element containing the selection */
  elementType: SelectionElementType;
  /** Whether the element is editable */
  isEditable: boolean;
  /** Whether the selection can be safely replaced */
  isReplaceable: boolean;
  /** Selection start position (for input/textarea) */
  selectionStart?: number;
  /** Selection end position (for input/textarea) */
  selectionEnd?: number;
  /** Unique identifier for the target element (data attribute or generated) */
  targetElementId?: string;
}

/**
 * Message types for streaming quick action responses to content script
 */
export type QuickActionStreamMessageType =
  | 'QUICK_ACTION_STREAM_START'
  | 'QUICK_ACTION_STREAM_DELTA'
  | 'QUICK_ACTION_STREAM_COMPLETE'
  | 'QUICK_ACTION_STREAM_ERROR';

/** Message sent when streaming starts */
export interface QuickActionStreamStartMessage {
  type: 'QUICK_ACTION_STREAM_START';
  actionId: string;
  action: string;
}

/** Message sent for each content delta */
export interface QuickActionStreamDeltaMessage {
  type: 'QUICK_ACTION_STREAM_DELTA';
  actionId: string;
  delta: string;
  fullContent: string;
}

/** Message sent when streaming completes */
export interface QuickActionStreamCompleteMessage {
  type: 'QUICK_ACTION_STREAM_COMPLETE';
  actionId: string;
  finalContent: string;
}

/** Message sent when an error occurs */
export interface QuickActionStreamErrorMessage {
  type: 'QUICK_ACTION_STREAM_ERROR';
  actionId: string;
  error: string;
}

/** Union type for all quick action stream messages */
export type QuickActionStreamMessage =
  | QuickActionStreamStartMessage
  | QuickActionStreamDeltaMessage
  | QuickActionStreamCompleteMessage
  | QuickActionStreamErrorMessage;

/** Text replacement behavior setting */
export type TextReplacementBehavior = 'ask' | 'auto' | 'never';

/** Result of a text replacement operation */
export interface TextReplacementResult {
  success: boolean;
  /** If failed, the reason */
  error?: string;
  /** If failed, whether content was copied to clipboard as fallback */
  copiedToClipboard?: boolean;
}
