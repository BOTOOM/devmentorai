/**
 * Writing Assistant Session Service
 * Manages the special "Writing Assistant" session used for quick actions
 */

import { ApiClient } from './api-client';
import {
  SUPPORTED_LLM_PROVIDERS,
  type Session,
  type LLMProvider,
} from '@devmentorai/shared';

const WRITING_ASSISTANT_SESSION_NAME = 'Writing Assistant';
const WRITING_ASSISTANT_SESSION_TYPE = 'writing';

// Cache the session to avoid repeated API calls
let cachedSession: Session | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 30000; // 30 seconds

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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    const serialized = JSON.stringify(error);
    return serialized ?? 'Unknown error';
  } catch {
    return 'Unknown error';
  }
}

async function resolveProviderForModel(
  apiClient: ApiClient,
  model: string,
  provider?: LLMProvider
): Promise<LLMProvider | undefined> {
  if (provider) {
    return provider;
  }

  try {
    const modelsResponse = await apiClient.getModels();
    const matchedProvider = modelsResponse.data?.models.find((item) => item.id === model)?.provider;
    if (matchedProvider && SUPPORTED_LLM_PROVIDERS.includes(matchedProvider as LLMProvider)) {
      return matchedProvider as LLMProvider;
    }
  } catch (error) {
    console.warn('[WritingAssistant] Failed to resolve provider from model, using default provider:', error);
  }

  return undefined;
}

function isRecoverableSessionError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return isLikelySessionRecoveryError(message);
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
          console.log('[WritingAssistant] Complete event, finalContent length:', finalContent.length);
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

/**
 * Get or create the Writing Assistant session
 * This session is used for all quick actions to provide fast AI responses
 */
export async function getOrCreateWritingAssistantSession(
  model?: string,
  provider?: LLMProvider
): Promise<Session | null> {
  const apiClient = ApiClient.getInstance();
  
  // Check cache
  const now = Date.now();
  if (
    cachedSession
    && (now - lastFetchTime) < CACHE_TTL_MS
    && (!provider || cachedSession.provider === provider)
    && (!model || cachedSession.model === model)
  ) {
    return cachedSession;
  }
  
  try {
    // Fetch all sessions
    const response = await apiClient.listSessions();
    
    if (!response.success || !response.data) {
      console.error('[WritingAssistant] Failed to list sessions:', response.error);
      return null;
    }
    
    // Look for existing Writing Assistant session
    const existingSession = response.data.items.find(
      session => session.name === WRITING_ASSISTANT_SESSION_NAME && 
                 session.type === WRITING_ASSISTANT_SESSION_TYPE
                 && (!provider || session.provider === provider)
    );
    
    if (existingSession) {
      let sessionToUse = existingSession;
      if (model && existingSession.model !== model) {
        const updateResponse = await apiClient.updateSession(existingSession.id, {
          model,
          provider,
        });

        if (updateResponse.success && updateResponse.data) {
          sessionToUse = updateResponse.data;
        } else {
          console.warn('[WritingAssistant] Failed to sync existing session model, reusing existing session', {
            sessionId: existingSession.id,
            requestedModel: model,
            currentModel: existingSession.model,
            error: updateResponse.error,
          });
        }
      }

      cachedSession = sessionToUse;
      lastFetchTime = now;
      console.log('[WritingAssistant] Found existing session:', sessionToUse.id);
      return sessionToUse;
    }
    
    // Create new Writing Assistant session
    console.log('[WritingAssistant] Creating new session with model:', model);
    const createResponse = await apiClient.createSession({
      name: WRITING_ASSISTANT_SESSION_NAME,
      type: WRITING_ASSISTANT_SESSION_TYPE,
      model: model,
      provider,
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
  return session.name === WRITING_ASSISTANT_SESSION_NAME && 
         session.type === WRITING_ASSISTANT_SESSION_TYPE;
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

async function recoverWritingAssistantSession(
  apiClient: ApiClient,
  session: Session,
  model: string,
  provider?: LLMProvider
): Promise<Session> {
  let resumeSucceeded = false;

  try {
    const resumeResponse = await apiClient.resumeSession(session.id);
    resumeSucceeded = resumeResponse.success;
  } catch (resumeError) {
    console.warn('[WritingAssistant] Resume attempt failed during recovery:', resumeError);
  }

  if (resumeSucceeded) {
    return session;
  }

  clearWritingAssistantCache();
  const recoveredSession = await getOrCreateWritingAssistantSession(model, provider);
  if (!recoveredSession) {
    throw new Error('Failed to recover writing assistant session');
  }

  return recoveredSession;
}

async function streamQuickActionWithRecovery(
  apiClient: ApiClient,
  session: Session,
  prompt: string,
  model: string,
  onEvent: (event: { type: string; content?: string; error?: string }) => void,
  signal?: AbortSignal,
  provider?: LLMProvider
): Promise<void> {
  try {
    await streamQuickActionOnce(apiClient, session.id, prompt, onEvent, signal);
  } catch (error) {
    if (!isRecoverableSessionError(error)) {
      throw error;
    }

    console.warn('[WritingAssistant] Recoverable session error detected, attempting one recovery cycle:', error);
    const recoveredSession = await recoverWritingAssistantSession(apiClient, session, model, provider);
    await streamQuickActionOnce(apiClient, recoveredSession.id, prompt, onEvent, signal);
  }
}

/**
 * Stream a quick action to the Writing Assistant session
 * Returns an async generator that yields stream events
 */
export async function streamQuickAction(
  prompt: string,
  model: string,
  onEvent: (event: { type: string; content?: string; error?: string }) => void,
  signal?: AbortSignal,
  provider?: LLMProvider
): Promise<void> {
  const apiClient = ApiClient.getInstance();
  const resolvedProvider = await resolveProviderForModel(apiClient, model, provider);
  const session = await getOrCreateWritingAssistantSession(model, resolvedProvider);
  
  if (!session) {
    onEvent({ type: 'error', error: 'Failed to get Writing Assistant session' });
    return;
  }
  
  try {
    await streamQuickActionWithRecovery(apiClient, session, prompt, model, onEvent, signal, resolvedProvider);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      onEvent({ type: 'error', error: 'Request cancelled' });
    } else {
      onEvent({ type: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
}
