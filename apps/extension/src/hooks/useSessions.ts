import type { ReasoningEffort, Session, SessionType } from '@devmentorai/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AcpClient } from '../services/acp-client';
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
  const acpClient = useMemo(() => new AcpClient({ url: 'ws://localhost:3847/acp' }), []);

  const loadSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.listSessions();
      if (response.success && response.data) {
        let nextSessions = response.data.items;
        try {
          await acpClient.connect();
          nextSessions = await acpClient.listAgentSessions();
        } catch {
          // Preserve imported sessions when the ACP gateway is unavailable.
        }
        setSessions(nextSessions);

        if (!activeSessionId && nextSessions.length > 0) {
          setActiveSessionId(nextSessions[0].id);
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
  }, [activeSessionId, acpClient, apiClient]);

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
    async (name: string, type: SessionType, model?: string, _reasoningEffort?: ReasoningEffort) => {
      try {
        await acpClient.connect();
        const record = await acpClient.createSession(undefined, '.');
        const createdSession: Session = {
          id: record.id,
          name,
          type,
          status: 'active',
          model: model ?? 'configured',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messageCount: 0,
          agentId: record.agentId,
          acpSessionId: record.acpSessionId,
          cwd: record.cwd,
          protocolVersion: record.protocolVersion,
          capabilities: record.capabilities,
          configOptions: record.configOptions,
          replaySupported: record.capabilities.agentCapabilities.loadSession === true,
        };
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

      const selected = sessions.find((session) => session.id === sessionId);
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
    [acpClient, sessions]
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
    async (sessionId: string, model: string, reasoningEffort?: ReasoningEffort) => {
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
