/**
 * Writing Assistant Session Service
 * Manages the special "Writing Assistant" session used for quick actions
 */

import { ApiClient } from './api-client';
import type { Session } from '@devmentorai/shared';

const WRITING_ASSISTANT_SESSION_NAME = 'Writing Assistant';
const WRITING_ASSISTANT_SESSION_TYPE = 'writing';

// Cache the session to avoid repeated API calls
let cachedSession: Session | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 30000; // 30 seconds

/**
 * Get or create the Writing Assistant session
 * This session is used for all quick actions to provide fast AI responses
 */
export async function getOrCreateWritingAssistantSession(
  model?: string
): Promise<Session | null> {
  const apiClient = ApiClient.getInstance();
  
  // Check cache
  const now = Date.now();
  if (cachedSession && (now - lastFetchTime) < CACHE_TTL_MS) {
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
    );
    
    if (existingSession) {
      cachedSession = existingSession;
      lastFetchTime = now;
      console.log('[WritingAssistant] Found existing session:', existingSession.id);
      return existingSession;
    }
    
    // Create new Writing Assistant session
    console.log('[WritingAssistant] Creating new session with model:', model);
    const createResponse = await apiClient.createSession({
      name: WRITING_ASSISTANT_SESSION_NAME,
      type: WRITING_ASSISTANT_SESSION_TYPE,
      model: model,
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
  const session = await getOrCreateWritingAssistantSession(model);
  
  if (!session) {
    onEvent({ type: 'error', error: 'Failed to get Writing Assistant session' });
    return;
  }
  
  const apiClient = ApiClient.getInstance();
  let fullContent = '';
  
  try {
    await apiClient.streamChat(
      session.id,
      { prompt },
      (event) => {
        console.log('[WritingAssistant] Stream event:', event.type, { 
          deltaContent: event.data.deltaContent?.substring(0, 30),
          content: event.data.content?.substring(0, 30),
          fullContent: fullContent.substring(0, 30) 
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
            
          case 'message_complete':
            // Use the complete content from the event if available, fallback to accumulated
            const finalContent = event.data.content || fullContent;
            console.log('[WritingAssistant] Complete event, finalContent length:', finalContent.length);
            onEvent({ type: 'complete', content: finalContent });
            break;
            
          case 'error':
            onEvent({ type: 'error', error: event.data.error || 'Unknown error' });
            break;
            
          case 'done':
            // Stream finished
            break;
        }
      },
      signal
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      onEvent({ type: 'error', error: 'Request cancelled' });
    } else {
      onEvent({ type: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
}
