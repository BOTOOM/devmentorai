/**
 * Update checker service for the DevMentorAI extension.
 * Periodically checks GitHub Releases for new versions of both
 * the extension and the backend.
 */

import { checkForUpdate, clearUpdateCache, type UpdateInfo } from '@devmentorai/shared';
import { EXTENSION_VERSION } from '../version.js';

const CHECK_INTERVAL_HOURS = 6;
const ALARM_NAME = 'devmentorai-update-check';

export interface UpdateState {
  extension: UpdateInfo | null;
  backend: UpdateInfo | null;
  lastChecked: number | null;
}

/**
 * Get the current backend version from the health endpoint.
 */
async function getBackendVersion(): Promise<string | null> {
  try {
    const result = await chrome.storage.local.get('backendUrl');
    const baseUrl = result.backendUrl || 'http://localhost:3847';
    const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(3000) });
    if (response.ok) {
      const data = await response.json();
      return data?.data?.version || null;
    }
  } catch {
    // Backend not running
  }
  return null;
}

/**
 * Run the update check and store results in chrome.storage.local.
 */
export async function performUpdateCheck(): Promise<UpdateState> {
  const state: UpdateState = {
    extension: null,
    backend: null,
    lastChecked: Date.now(),
  };

  try {
    // Check extension update
    state.extension = await checkForUpdate('extension', EXTENSION_VERSION);
  } catch {
    // Ignore
  }

  try {
    // Check backend update only if backend is running
    const backendVersion = await getBackendVersion();
    if (backendVersion) {
      state.backend = await checkForUpdate('backend', backendVersion);
    }
  } catch {
    // Ignore
  }

  // Persist to storage
  await chrome.storage.local.set({ updateState: state });

  // Keep update info in storage; UI can read it from settings/panel.

  return state;
}

/**
 * Get the cached update state from chrome.storage.local.
 */
export async function getUpdateState(): Promise<UpdateState | null> {
  const result = await chrome.storage.local.get('updateState');
  return result.updateState || null;
}

/**
 * Set up the periodic update check alarm.
 * Call this from the background service worker.
 */
export function setupUpdateAlarm(): void {
  // Create periodic alarm
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 5, // First check 5 min after install/startup
    periodInMinutes: CHECK_INTERVAL_HOURS * 60,
  });

  // Listen for alarm
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      performUpdateCheck();
    }
  });
}

/**
 * Force a refresh of the update check (clears cache).
 */
export async function forceUpdateCheck(): Promise<UpdateState> {
  clearUpdateCache();
  return performUpdateCheck();
}

/**
 * Dismiss the update notification badge.
 */
export async function dismissUpdateBadge(): Promise<void> {
  // No-op in Firefox build to avoid unsupported badge API warnings.
}



export {EXTENSION_VERSION} from '../version.js';