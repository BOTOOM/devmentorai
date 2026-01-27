import { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../services/api-client';
import type { Session, SessionType, CreateSessionRequest } from '@devmentorai/shared';

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiClient = ApiClient.getInstance();

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

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

  const createSession = useCallback(async (name: string, type: SessionType) => {
    try {
      const request: CreateSessionRequest = { name, type };
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

  const selectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    try {
      const response = await apiClient.deleteSession(sessionId);
      
      if (response.success) {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        
        // If deleted session was active, select another
        if (activeSessionId === sessionId) {
          const remaining = sessions.filter(s => s.id !== sessionId);
          setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
        }
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
