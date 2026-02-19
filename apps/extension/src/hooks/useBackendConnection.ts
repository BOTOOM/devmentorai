import { useState, useEffect, useCallback, useRef } from 'react';
import { DEFAULT_CONFIG } from '@devmentorai/shared';
import type { HealthResponse } from '@devmentorai/shared';
import { storageGet } from '../lib/browser-utils';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
const RECONNECT_DELAY = 5000; // 5 seconds

export function useBackendConnection() {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const intervalRef = useRef<ReturnType<typeof globalThis.setInterval> | null>(null);

  const defaultBaseUrl = `http://${DEFAULT_CONFIG.DEFAULT_HOST}:${DEFAULT_CONFIG.DEFAULT_PORT}`;
  const [baseUrl, setBaseUrl] = useState(defaultBaseUrl);

  const checkHealth = useCallback(async () => {
    try {
      const { backendUrl } = await storageGet<{ backendUrl?: string }>('backendUrl');
      const resolvedBaseUrl = backendUrl?.trim() ? backendUrl.trim().replace(/\/+$/, '') : defaultBaseUrl;
      setBaseUrl(resolvedBaseUrl);

      const response = await fetch(`${resolvedBaseUrl}/api/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        setHealth(data.data);
        setStatus('connected');
        setError(null);
      } else {
        throw new Error(data.error?.message || 'Invalid health response');
      }
    } catch (err) {
      console.error('[useBackendConnection] Health check failed:', err);
      setStatus('disconnected');
      setHealth(null);
      setError(
        chrome.i18n.getMessage('error_connection') ||
        'Failed to connect to backend. Make sure the DevMentorAI server is running.'
      );
    }
  }, [defaultBaseUrl]);

  // Initial connection and periodic health checks
  useEffect(() => {
    checkHealth();

    intervalRef.current = globalThis.setInterval(() => {
      if (status !== 'connecting') {
        checkHealth();
      }
    }, HEALTH_CHECK_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkHealth, status]);

  // Reconnect when disconnected
  useEffect(() => {
    if (status === 'disconnected') {
      const timeout = setTimeout(() => {
        setStatus('connecting');
        checkHealth();
      }, RECONNECT_DELAY);

      return () => clearTimeout(timeout);
    }
  }, [status, checkHealth]);

  return {
    status,
    error,
    health,
    baseUrl,
    reconnect: checkHealth,
  };
}
