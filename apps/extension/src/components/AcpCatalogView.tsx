import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AcpCatalogEntry, AcpClient, AcpProfile } from '../services/acp-client';

type AcpCatalogViewProps = {
  client: AcpClient;
  selectedProfileId?: string;
  onProfileSelected?: (profile: AcpProfile) => void;
  /** Opens the full agents section; the side panel wires it to the options page. */
  onManageAgents?: () => void;
};

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800';

/**
 * Compact agent picker for the side panel: enable an agent with one click and
 * choose which profile the next session uses. Advanced management lives in the
 * options page.
 */
export function AcpCatalogView({
  client,
  selectedProfileId,
  onProfileSelected,
  onManageAgents,
}: Readonly<AcpCatalogViewProps>) {
  const [entries, setEntries] = useState<AcpCatalogEntry[]>([]);
  const [profiles, setProfiles] = useState<AcpProfile[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [nextEntries, nextProfiles] = await Promise.all([
      client.listAgents(),
      client.listProfiles(),
    ]);
    setError(null);
    setEntries(nextEntries);
    setProfiles(nextProfiles);
  }, [client]);

  const reload = useCallback(() => {
    setLoading(true);
    void refresh()
      .catch((refreshError: unknown) => {
        setError(
          refreshError instanceof Error ? refreshError.message : 'Failed to load the agent catalog'
        );
      })
      .finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const first = profiles[0];
    if (!selectedProfileId && first) onProfileSelected?.(first);
  }, [profiles, selectedProfileId, onProfileSelected]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matching = needle
      ? entries.filter((entry) =>
          `${entry.name} ${entry.description ?? ''}`.toLowerCase().includes(needle)
        )
      : entries;
    return [...matching].sort((left, right) => {
      if (Boolean(left.enabled) !== Boolean(right.enabled)) return left.enabled ? -1 : 1;
      return left.name.localeCompare(right.name);
    });
  }, [entries, query]);

  const enable = (entry: AcpCatalogEntry) => {
    setBusy(entry.id);
    setError(null);
    void client
      .enableAgent(entry.id)
      .then((result) => {
        onProfileSelected?.(result.profile);
        return refresh();
      })
      .catch((enableError: unknown) => {
        setError(enableError instanceof Error ? enableError.message : 'Failed to enable the agent');
      })
      .finally(() => setBusy(null));
  };

  return (
    <section aria-label="ACP agent catalog" className="space-y-3 p-3">
      <label className="block">
        <span className="sr-only">Search agents</span>
        <input
          className={`w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white ${FOCUS_RING}`}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search agents"
          type="search"
          value={query}
        />
      </label>

      {error ? (
        <div
          className="flex items-start justify-between gap-3 rounded-lg bg-red-50 p-2 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200"
          role="alert"
        >
          <p>{error}</p>
          <button className={`font-medium underline ${FOCUS_RING}`} onClick={reload} type="button">
            Retry
          </button>
        </div>
      ) : null}

      {loading ? <p className="text-sm text-gray-500 dark:text-gray-400">Loading agents…</p> : null}

      <ul className="max-h-64 space-y-2 overflow-y-auto">
        {filtered.map((entry) => (
          <li
            className="flex items-center gap-2 rounded-lg border border-gray-200 p-2 dark:border-gray-700"
            key={entry.id}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                {entry.name}
                {entry.default ? <span className="ml-1 text-amber-500">★</span> : null}
              </p>
              <p className="truncate text-xs text-gray-600 dark:text-gray-300">
                {entry.platformAvailability.available
                  ? entry.authState === 'required'
                    ? 'Auth required'
                    : entry.enabled
                      ? 'Enabled'
                      : (entry.description ?? '')
                  : (entry.platformAvailability.reason ?? 'Unavailable')}
              </p>
            </div>
            {entry.platformAvailability.available ? (
              <button
                className={`shrink-0 rounded-lg px-2 py-1 text-xs font-medium ${
                  entry.enabled
                    ? 'border border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-200'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                } disabled:opacity-50 ${FOCUS_RING}`}
                disabled={busy === entry.id || entry.enabled}
                onClick={() => enable(entry)}
                type="button"
              >
                {entry.enabled ? 'Enabled' : busy === entry.id ? 'Enabling…' : 'Enable'}
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <label className="block text-sm text-gray-700 dark:text-gray-200">
        Profile
        <select
          aria-label="ACP profile"
          className={`ml-2 rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white ${FOCUS_RING}`}
          onChange={(event) => {
            const profile = profiles.find((candidate) => candidate.id === event.target.value);
            if (profile) onProfileSelected?.(profile);
          }}
          value={selectedProfileId ?? profiles[0]?.id ?? ''}
        >
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>
      </label>

      {onManageAgents ? (
        <button
          className={`text-sm text-primary-600 hover:underline dark:text-primary-400 ${FOCUS_RING}`}
          onClick={onManageAgents}
          type="button"
        >
          Manage agents and authentication
        </button>
      ) : null}
    </section>
  );
}
