import type { Session, SessionType } from '@devmentorai/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AcpClient } from '../services/acp-client';
import { ApiClient } from '../services/api-client';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface UseSessionsOptions {
  connectionStatus?: ConnectionStatus;
  acpClient?: AcpClient;
}

export function useSessions(options?: UseSessionsOptions) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevConnectionStatus = useRef<ConnectionStatus | undefined>(options?.connectionStatus);

  const apiClient = useMemo(() => ApiClient.getInstance(), []);
  const ownAcpClient = useMemo(
    () => (options?.acpClient ? undefined : new AcpClient({ url: 'ws://127.0.0.1:3847/acp' })),
    [options?.acpClient]
  );
  const acpClient = options?.acpClient ?? (ownAcpClient as AcpClient);
  const sessionsRef = useRef<Session[]>([]);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.listSessions();
      if (response.success && response.data) {
        let nextSessions = response.data.items;
        try {
          await acpClient.connect();
          const acpSessions = await acpClient.listAgentSessions();
          const byId = new Map(nextSessions.map((session) => [session.id, session]));
          for (const session of acpSessions) byId.set(session.id, session);
          nextSessions = [...byId.values()];
        } catch {
          // Cached sessions remain available when ACP history is unavailable.
        }
        setSessions(nextSessions);

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
  }, [acpClient, activeSessionId, apiClient]);

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
    async (name: string, type: SessionType) => {
      try {
        const response = await apiClient.createSession({ name, type });
        if (!response.success || !response.data) {
          throw new Error(response.error?.message || 'Failed to create session');
        }
        const createdSession = response.data;
        setSessions((prev) => [...prev, createdSession]);
        setActiveSessionId(createdSession.id);
        return createdSession;
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

      const selected = sessionsRef.current.find((session) => session.id === sessionId);
      if (selected?.agentId && selected.replaySupported) {
        try {
          await acpClient.connect();
          await acpClient.loadSession(sessionId);
          return;
        } catch (err) {
          console.warn('[useSessions] Failed to load ACP session history:', err);
        }
      }

      // Non-replay ACP agents intentionally render their local cache read-only.
    },
    [acpClient]
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

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

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
