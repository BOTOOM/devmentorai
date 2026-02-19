/**
 * Browser compatibility helpers for Chrome/Firefox extension APIs.
 */

type BrowserNamespace = {
  storage?: {
    local?: {
      get?: (keys?: string | string[] | Record<string, unknown>) => Promise<Record<string, unknown>>;
      set?: (items: Record<string, unknown>) => Promise<void>;
      remove?: (keys: string | string[]) => Promise<void>;
    };
  };
  tabs?: {
    query?: (queryInfo: chrome.tabs.QueryInfo) => Promise<chrome.tabs.Tab[]>;
    captureVisibleTab?: (
      windowId?: number,
      options?: CaptureVisibleTabOptions
    ) => Promise<string>;
  };
  windows?: {
    get?: (windowId: number) => Promise<chrome.windows.Window>;
    getCurrent?: () => Promise<chrome.windows.Window>;
  };
};

function getBrowserApi(): BrowserNamespace | undefined {
  return (globalThis as { browser?: BrowserNamespace }).browser;
}

export type CaptureVisibleTabOptions = {
  format?: 'jpeg' | 'png';
  quality?: number;
};

export async function storageGet<T extends Record<string, unknown> = Record<string, unknown>>(
  keys?: string | string[] | Record<string, unknown>
): Promise<T> {
  const browserApi = getBrowserApi();
  if (browserApi?.storage?.local?.get) {
    return browserApi.storage.local.get(keys) as Promise<T>;
  }

  return new Promise<T>((resolve, reject) => {
    chrome.storage.local.get(keys as never, (items) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || 'Failed to read storage'));
        return;
      }
      resolve((items ?? {}) as T);
    });
  });
}

export async function storageSet(items: object): Promise<void> {
  const browserApi = getBrowserApi();
  if (browserApi?.storage?.local?.set) {
    await browserApi.storage.local.set(items as Record<string, unknown>);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    chrome.storage.local.set(items as Record<string, unknown>, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || 'Failed to write storage'));
        return;
      }
      resolve();
    });
  });
}

export async function storageRemove(keys: string | string[]): Promise<void> {
  const browserApi = getBrowserApi();
  if (browserApi?.storage?.local?.remove) {
    await browserApi.storage.local.remove(keys);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    chrome.storage.local.remove(keys as never, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || 'Failed to remove storage key'));
        return;
      }
      resolve();
    });
  });
}

export async function queryTabs(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
  const browserApi = getBrowserApi();
  if (browserApi?.tabs?.query) {
    return browserApi.tabs.query(queryInfo);
  }

  return new Promise<chrome.tabs.Tab[]>((resolve, reject) => {
    chrome.tabs.query(queryInfo, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || 'Failed to query tabs'));
        return;
      }
      resolve(tabs ?? []);
    });
  });
}

export async function captureVisibleTab(
  windowId: number | undefined,
  options: CaptureVisibleTabOptions
): Promise<string> {
  const browserApi = getBrowserApi();
  if (browserApi?.tabs?.captureVisibleTab) {
    return browserApi.tabs.captureVisibleTab(windowId, options);
  }

  return new Promise<string>((resolve, reject) => {
    const callback = (dataUrl: string) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || 'Failed to capture visible tab'));
        return;
      }
      resolve(dataUrl);
    };

    const tabsApi = chrome.tabs as typeof chrome.tabs & {
      captureVisibleTab: (...args: unknown[]) => void;
    };

    if (typeof windowId === 'number') {
      tabsApi.captureVisibleTab(windowId, options, callback);
      return;
    }

    tabsApi.captureVisibleTab(options, callback);
  });
}

export async function getWindowById(windowId: number): Promise<chrome.windows.Window> {
  const browserApi = getBrowserApi();
  if (browserApi?.windows?.get) {
    return browserApi.windows.get(windowId);
  }

  return new Promise<chrome.windows.Window>((resolve, reject) => {
    chrome.windows.get(windowId, (window) => {
      if (chrome.runtime.lastError || !window) {
        reject(new Error(chrome.runtime.lastError?.message || 'Failed to get window'));
        return;
      }
      resolve(window);
    });
  });
}

export async function getCurrentWindow(): Promise<chrome.windows.Window> {
  const browserApi = getBrowserApi();
  if (browserApi?.windows?.getCurrent) {
    return browserApi.windows.getCurrent();
  }

  return new Promise<chrome.windows.Window>((resolve, reject) => {
    chrome.windows.getCurrent((window) => {
      if (chrome.runtime.lastError || !window) {
        reject(new Error(chrome.runtime.lastError?.message || 'Failed to get current window'));
        return;
      }
      resolve(window);
    });
  });
}

/**
 * Find the best active tab from extension contexts (popup/sidepanel/background).
 */
export async function getBestActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const strategies: chrome.tabs.QueryInfo[] = [
    { active: true, currentWindow: true },
    { active: true, lastFocusedWindow: true },
    { active: true },
  ];

  for (const query of strategies) {
    try {
      const tabs = await queryTabs(query);
      if (tabs.length > 0) {
        return tabs[0];
      }
    } catch {
      // Ignore and continue with fallback strategy.
    }
  }

  return undefined;
}

/**
 * Browser-internal pages where content scripts or screenshots are restricted.
 */
export function isBrowserInternalUrl(url?: string): boolean {
  if (!url) return true;

  const blockedProtocols = [
    'chrome://',
    'chrome-extension://',
    'about:',
    'edge://',
    'brave://',
    'opera://',
    'vivaldi://',
    'moz-extension://',
    'file://',
  ];

  return blockedProtocols.some((protocol) => url.startsWith(protocol));
}
