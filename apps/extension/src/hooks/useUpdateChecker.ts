/**
 * Hook for accessing update state from the extension background.
 */
import { useState, useEffect, useCallback } from 'react';
import type { UpdateInfo } from '@devmentorai/shared';

interface UpdateState {
  extension: UpdateInfo | null;
  backend: UpdateInfo | null;
  lastChecked: number | null;
}

export function useUpdateChecker() {
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // Load cached state on mount
  useEffect(() => {
    const loadState = async () => {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_UPDATE_STATE' });
        if (response) {
          setUpdateState(response);
        }
      } catch {
        // Background not ready
      }
    };
    loadState();
  }, []);

  const checkNow = useCallback(async () => {
    setIsChecking(true);
    try {
      const response = await chrome.runtime.sendMessage({ type: 'CHECK_UPDATES' });
      if (response) {
        setUpdateState(response);
      }
    } catch {
      // Ignore
    } finally {
      setIsChecking(false);
    }
  }, []);

  const dismissBadge = useCallback(async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'DISMISS_UPDATE_BADGE' });
    } catch {
      // Ignore
    }
  }, []);

  const hasAnyUpdate = updateState?.extension?.hasUpdate || updateState?.backend?.hasUpdate;

  return {
    updateState,
    isChecking,
    hasAnyUpdate: !!hasAnyUpdate,
    checkNow,
    dismissBadge,
  };
}
