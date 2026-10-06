/**
 * Writing Assistant Session Service
 * Manages the special "Writing Assistant" session used for quick actions
 */

import type { ReasoningEffort, Session } from '@devmentorai/shared';
import { ApiClient } from './api-client';
import { getEffectiveQuickActionModel, invalidateModelAvailabilityCache } from './model-catalog';

export const SESSION_MESSAGES_UPDATED = 'SESSION_MESSAGES_UPDATED';

const WRITING_ASSISTANT_SESSION_NAME = 'Writing Assistant';
const WRITING_ASSISTANT_SESSION_TYPE = 'writing';
const SESSION_PAGE_SIZE = 50;

// Cache the session to avoid repeated API calls
let cachedSession: Session | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 30000; // 30 seconds

export function notifySessionMessagesUpdated(sessionId: string): void {
  try {
    void chrome.runtime.sendMessage({ type: SESSION_MESSAGES_UPDATED, sessionId }).catch(() => {});
  } catch {}
}

function isLikelySessionRecoveryError(message: string): boolean {
  const normalized = message.toLowerCase();

  return [
    'session not found',
    'stream request failed: 404',
    'stream request failed: 410',
    'invalid session',
    'session does not exist',
    'failed to get writing assistant session',
  ].some((token) => normalized.includes(token));
}

function isRecoverableSessionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return isLikelySessionRecoveryError(message);
}

function isModelUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('MODEL_UNAVAILABLE') || message.toLowerCase().includes('not available');
}

async function streamQuickActionOnce(
  apiClient: ApiClient,
  sessionId: string,
  prompt: string,
  onEvent: (event: { type: string; content?: string; error?: string }) => void,
  signal?: AbortSignal
): Promise<void> {
  let fullContent = '';
  let deferredSessionError: string | null = null;

  await apiClient.streamChat(
    sessionId,
    { prompt },
    (event) => {
      console.log('[WritingAssistant] Stream event:', event.type, {
        deltaContent: event.data.deltaContent?.substring(0, 30),
        content: event.data.content?.substring(0, 30),
        fullContent: fullContent.substring(0, 30),
      });

      switch (event.type) {
        case 'message_start':
          onEvent({ type: 'start' });
          break;

        case 'message_delta':
          if (event.data.deltaContent) {
            fullContent += event.data.deltaContent;
            onEvent({ type: 'delta', content: fullContent });
          }
          break;

        case 'message_complete': {
          const finalContent = event.data.content || fullContent;
          console.log(
            '[WritingAssistant] Complete event, finalContent length:',
            finalContent.length
          );
          onEvent({ type: 'complete', content: finalContent });
          break;
        }

        case 'error': {
          const streamError = event.data.error || 'Unknown error';
          if (isLikelySessionRecoveryError(streamError)) {
            deferredSessionError = streamError;
          } else {
            onEvent({ type: 'error', error: streamError });
          }
          break;
        }

        case 'done':
          break;
      }
    },
    signal
  );

  if (deferredSessionError) {
    throw new Error(deferredSessionError);
  }
}

async function ensureWritingAssistantModel(
  apiClient: ApiClient,
  session: Session,
  model?: string,
  reasoningEffort?: ReasoningEffort
): Promise<Session> {
  const nextModel = model || session.model;
  const modelChanged = Boolean(model && session.model !== model);
  const reasoningEffortChanged = (reasoningEffort ?? null) !== (session.reasoningEffort ?? null);

  if (!modelChanged && !reasoningEffortChanged) {
    return session;
  }

  console.log('[WritingAssistant] Switching existing session model:', {
    sessionId: session.id,
    from: session.model,
    to: nextModel,
  });

  const response = await apiClient.switchSessionModel(session.id, nextModel, reasoningEffort);

  if (!response.success || !response.data) {
    const codePrefix = response.error?.code ? `${response.error.code}: ` : '';
    throw new Error(
      `${codePrefix}${response.error?.message || 'Failed to switch Writing Assistant model'}`
    );
  }

  cachedSession = response.data;
  lastFetchTime = Date.now();
  return response.data;
}

/**
 * Get or create the Writing Assistant session
 * This session is used for all quick actions to provide fast AI responses
 */
export async function getOrCreateWritingAssistantSession(
  model?: string,
  reasoningEffort?: ReasoningEffort
): Promise<Session | null> {
  const apiClient = ApiClient.getInstance();

  // Check cache
  const now = Date.now();
  if (cachedSession && now - lastFetchTime < CACHE_TTL_MS) {
    return ensureWritingAssistantModel(apiClient, cachedSession, model, reasoningEffort);
  }

  try {
    let existingSession: Session | undefined;
    for (let page = 1; ; page++) {
      const response = await apiClient.listSessions(page, SESSION_PAGE_SIZE);

      if (!response.success || !response.data) {
        console.error('[WritingAssistant] Failed to list sessions:', response.error);
        return null;
      }

      if (response.data.items.length === 0) {
        break;
      }

      existingSession = response.data.items.find(
        (session) =>
          session.name === WRITING_ASSISTANT_SESSION_NAME &&
          session.type === WRITING_ASSISTANT_SESSION_TYPE
      );
      if (existingSession || !response.data.hasMore) {
        break;
      }
    }

    if (existingSession) {
      const session = await ensureWritingAssistantModel(
        apiClient,
        existingSession,
        model,
        reasoningEffort
      );
      cachedSession = session;
      lastFetchTime = now;
      console.log('[WritingAssistant] Found existing session:', session.id);
      return session;
    }

    // Create new Writing Assistant session
    console.log('[WritingAssistant] Creating new session with model:', model);
    const createResponse = await apiClient.createSession({
      name: WRITING_ASSISTANT_SESSION_NAME,
      type: WRITING_ASSISTANT_SESSION_TYPE,
      model: model,
      ...(reasoningEffort ? { reasoningEffort } : {}),
    });

    if (!createResponse.success || !createResponse.data) {
      console.error('[WritingAssistant] Failed to create session:', createResponse.error);
      return null;
    }

    cachedSession = createResponse.data;
    lastFetchTime = now;
    console.log('[WritingAssistant] Created new session:', createResponse.data.id);
    return createResponse.data;
  } catch (error) {
    console.error('[WritingAssistant] Error getting/creating session:', error);
    return null;
  }
}

/**
 * Check if a session is the Writing Assistant session
 */
export function isWritingAssistantSession(session: Session): boolean {
  return (
    session.name === WRITING_ASSISTANT_SESSION_NAME &&
    session.type === WRITING_ASSISTANT_SESSION_TYPE
  );
}

/**
 * Get the Writing Assistant session name (for display)
 */
export function getWritingAssistantSessionName(): string {
  return WRITING_ASSISTANT_SESSION_NAME;
}

/**
 * Clear the cached session (useful when session is deleted)
 */
export function clearWritingAssistantCache(): void {
  cachedSession = null;
  lastFetchTime = 0;
}

/**
 * Stream a quick action to the Writing Assistant session
 * Returns an async generator that yields stream events
 */
export async function streamQuickAction(
  prompt: string,
  model: string,
  onEvent: (event: { type: string; content?: string; error?: string }) => void,
  signal?: AbortSignal
): Promise<void> {
  const effectiveQuickActionModel = await getEffectiveQuickActionModel(model);
  let effectiveModel = effectiveQuickActionModel.modelId;
  let reasoningEffort = effectiveQuickActionModel.reasoningEffort;
  let session = await getOrCreateWritingAssistantSession(effectiveModel, reasoningEffort);

  if (!session) {
    onEvent({ type: 'error', error: 'Failed to get Writing Assistant session' });
    return;
  }

  const apiClient = ApiClient.getInstance();
  let streamedSessionId = session.id;

  try {
    try {
      await streamQuickActionOnce(apiClient, session.id, prompt, onEvent, signal);
      return;
    } catch (error) {
      if (!isRecoverableSessionError(error)) {
        throw error;
      }

      console.warn(
        '[WritingAssistant] Recoverable session error detected, attempting one recovery cycle:',
        error
      );

      let resumeSucceeded = false;
      try {
        const resumeResponse = await apiClient.resumeSession(session.id);
        resumeSucceeded = resumeResponse.success;
      } catch (resumeError) {
        console.warn('[WritingAssistant] Resume attempt failed during recovery:', resumeError);
      }

      if (!resumeSucceeded) {
        clearWritingAssistantCache();
        const recoveredSession = await getOrCreateWritingAssistantSession(
          effectiveModel,
          reasoningEffort
        );
        if (!recoveredSession) {
          throw error;
        }
        session = recoveredSession;
        streamedSessionId = session.id;
      }

      await streamQuickActionOnce(apiClient, session.id, prompt, onEvent, signal);
    }
  } catch (error) {
    if (isModelUnavailableError(error)) {
      await invalidateModelAvailabilityCache();
      const fallbackModel = await getEffectiveQuickActionModel(effectiveModel, {
        forceRefresh: true,
        excludeModelIds: [effectiveModel],
      });

      if (fallbackModel.modelId !== effectiveModel) {
        effectiveModel = fallbackModel.modelId;
        reasoningEffort = fallbackModel.reasoningEffort;
        clearWritingAssistantCache();
        session = await getOrCreateWritingAssistantSession(effectiveModel, reasoningEffort);
        if (session) {
          streamedSessionId = session.id;
          try {
            await streamQuickActionOnce(apiClient, session.id, prompt, onEvent, signal);
            return;
          } catch (retryError) {
            onEvent({
              type: 'error',
              error: retryError instanceof Error ? retryError.message : 'Unknown error',
            });
            return;
          }
        }
      }
    }

    if (error instanceof Error && error.name === 'AbortError') {
      onEvent({ type: 'error', error: 'Request cancelled' });
    } else {
      onEvent({ type: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  } finally {
    notifySessionMessagesUpdated(streamedSessionId);
  }
}
