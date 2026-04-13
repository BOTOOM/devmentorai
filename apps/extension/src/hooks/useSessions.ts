import type { CreateSessionRequest, Session, SessionType } from '@devmentorai/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiClient } from '../services/api-client';

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

  const apiClient = useMemo(() => ApiClient.getInstance(), []);

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.listSessions();
      if (response.success && response.data) {
        setSessions(response.data.items);

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
  }, [activeSessionId, apiClient]);

  // Load sessions on mount
  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  // Reload sessions when backend reconnects
  useEffect(() => {
    const currentStatus = options?.connectionStatus;
    const prevStatus = prevConnectionStatus.current;

    // If backend just connected (was disconnected/connecting, now connected), reload sessions
    if (currentStatus === 'connected' && prevStatus && prevStatus !== 'connected') {
      console.log('[useSessions] Backend reconnected, reloading sessions');
      void loadSessions();
    }

    prevConnectionStatus.current = currentStatus;
  }, [loadSessions, options?.connectionStatus]);

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

  const createSession = useCallback(
    async (
      name: string,
      type: SessionType,
      model?: string,
      reasoningEffort?: 'low' | 'medium' | 'high'
    ) => {
      try {
        const request: CreateSessionRequest = { name, type, model, reasoningEffort };
        const response = await apiClient.createSession(request);

        if (response.success && response.data) {
          const createdSession = response.data;
          setSessions((prev) => [...prev, createdSession]);
          setActiveSessionId(createdSession.id);
          return createdSession;
        }
        throw new Error(response.error?.message || 'Failed to create session');
      } catch (err) {
        console.error('[useSessions] Failed to create session:', err);
        throw err;
      }
    },
    [apiClient]
  );

  const selectSession = useCallback(
    async (sessionId: string) => {
      setActiveSessionId(sessionId);

      // Resume session on backend to restore Copilot context
      try {
        await apiClient.resumeSession(sessionId);
      } catch (err) {
        console.warn('[useSessions] Failed to resume session:', err);
        // Don't fail silently - the session is still selected but may not have full context
      }
    },
    [apiClient]
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        const response = await apiClient.deleteSession(sessionId);

        if (response.success) {
          setSessions((prev) => prev.filter((s) => s.id !== sessionId));

          // If deleted session was active, select another and clean up storage
          if (activeSessionId === sessionId) {
            const remaining = sessions.filter((s) => s.id !== sessionId);
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
    },
    [activeSessionId, apiClient, sessions]
  );

  const updateSessionModel = useCallback(
    async (sessionId: string, model: string, reasoningEffort?: 'low' | 'medium' | 'high') => {
      // Use switchSessionModel which calls SDK v0.2.x setModel() for seamless switching
      const response = await apiClient.switchSessionModel(sessionId, model, reasoningEffort);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to update session model');
      }

      const updatedSession = response.data;

      setSessions((prev) =>
        prev.map((session) => (session.id === sessionId ? updatedSession : session))
      );

      return updatedSession;
    },
    [apiClient]
  );

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  return {
    sessions,
    activeSession,
    activeSessionId,
    isLoading,
    error,
    createSession,
    updateSessionModel,
    selectSession,
    deleteSession,
    refreshSessions: loadSessions,
  };
}
