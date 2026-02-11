import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiClient } from '../services/api-client';
import type { Session, SessionType, CreateSessionRequest } from '@devmentorai/shared';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface UseSessionsOptions {
  connectionStatus?: ConnectionStatus;
}

export function useSessions(options?: UseSessionsOptions) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevConnectionStatus = useRef<ConnectionStatus | undefined>(options?.connectionStatus);

  const apiClient = ApiClient.getInstance();

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  // Reload sessions when backend reconnects
  useEffect(() => {
    const currentStatus = options?.connectionStatus;
    const prevStatus = prevConnectionStatus.current;
    
    // If backend just connected (was disconnected/connecting, now connected), reload sessions
    if (currentStatus === 'connected' && prevStatus && prevStatus !== 'connected') {
      console.log('[useSessions] Backend reconnected, reloading sessions');
      loadSessions();
    }
    
    prevConnectionStatus.current = currentStatus;
  }, [options?.connectionStatus]);

  // Load active session from storage
  useEffect(() => {
    chrome.storage.local.get('activeSessionId', (result) => {
      if (result.activeSessionId) {
        setActiveSessionId(result.activeSessionId);
      }
    });
  }, []);

  // Save active session to storage
  useEffect(() => {
    if (activeSessionId) {
      chrome.storage.local.set({ activeSessionId });
    }
  }, [activeSessionId]);

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.listSessions();
      if (response.success && response.data) {
        setSessions(response.data.items);
        
        // Auto-select first session if none selected
        if (!activeSessionId && response.data.items.length > 0) {
          setActiveSessionId(response.data.items[0].id);
        }
      } else {
        setError(response.error?.message || 'Failed to load sessions');
      }
    } catch (err) {
      console.error('[useSessions] Failed to load sessions:', err);
      setError('Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  };

  const createSession = useCallback(async (name: string, type: SessionType, model?: string) => {
    try {
      const request: CreateSessionRequest = { name, type, model };
      const response = await apiClient.createSession(request);
      
      if (response.success && response.data) {
        setSessions(prev => [...prev, response.data!]);
        setActiveSessionId(response.data.id);
        return response.data;
      } else {
        throw new Error(response.error?.message || 'Failed to create session');
      }
    } catch (err) {
      console.error('[useSessions] Failed to create session:', err);
      throw err;
    }
  }, []);

  const selectSession = useCallback(async (sessionId: string) => {
    setActiveSessionId(sessionId);
    
    // Resume session on backend to restore Copilot context
    try {
      await apiClient.resumeSession(sessionId);
    } catch (err) {
      console.warn('[useSessions] Failed to resume session:', err);
      // Don't fail silently - the session is still selected but may not have full context
    }
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      const response = await apiClient.deleteSession(sessionId);
      
      if (response.success) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        
        // If deleted session was active, select another and clean up storage
        if (activeSessionId === sessionId) {
          const remaining = sessions.filter(s => s.id !== sessionId);
          const newActiveId = remaining.length > 0 ? remaining[0].id : null;
          setActiveSessionId(newActiveId);
          
          // Clean up chrome storage - remove reference to deleted session
          if (newActiveId) {
            chrome.storage.local.set({ activeSessionId: newActiveId });
          } else {
            chrome.storage.local.remove('activeSessionId');
          }
        }
        
        console.log('[useSessions] Session deleted successfully:', sessionId);
      } else {
        throw new Error(response.error?.message || 'Failed to delete session');
      }
    } catch (err) {
      console.error('[useSessions] Failed to delete session:', err);
      throw err;
    }
  }, [activeSessionId, sessions]);

  const activeSession = sessions.find(s => s.id === activeSessionId) || null;

  return {
    sessions,
    activeSession,
    activeSessionId,
    isLoading,
    error,
    createSession,
    selectSession,
    deleteSession,
    refreshSessions: loadSessions,
  };
}
