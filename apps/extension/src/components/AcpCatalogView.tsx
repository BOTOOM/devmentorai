import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AcpCatalogEntry, AcpClient, AcpProfile } from '../services/acp-client';

type AcpCatalogViewProps = {
  client: AcpClient;
  selectedProfileId?: string;
  onProfileSelected?: (profile: AcpProfile) => void;
};

export function AcpCatalogView({
  client,
  selectedProfileId,
  onProfileSelected,
}: Readonly<AcpCatalogViewProps>) {
  const [entries, setEntries] = useState<AcpCatalogEntry[]>([]);
  const [profiles, setProfiles] = useState<AcpProfile[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [nextEntries, nextProfiles] = await Promise.all([
      client.listAgents(),
      client.listProfiles(),
    ]);
    setError(null);
    setEntries(nextEntries);
    setProfiles(nextProfiles);
    if (nextProfiles[0] && !selectedProfileId) onProfileSelected?.(nextProfiles[0]);
  }, [client, onProfileSelected, selectedProfileId]);
  useEffect(() => {
    void refresh().catch((refreshError: unknown) => {
      setError(
        refreshError instanceof Error ? refreshError.message : 'Failed to load the agent catalog'
      );
    });
  }, [refresh]);

  const filtered = useMemo(
    () =>
      entries.filter((entry) =>
        `${entry.name} ${entry.description ?? ''}`.toLowerCase().includes(query.toLowerCase())
      ),
    [entries, query]
  );
  return (
    <section aria-label="ACP agent catalog" className="space-y-3 p-3">
      <input
        aria-label="Search agents"
        className="w-full rounded border px-2 py-1"
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search agents"
        value={query}
      />
      <div className="space-y-2">
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {filtered.map((entry) => (
          <article className="rounded border p-2" key={entry.id}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">{entry.name}</h3>
                <p className="text-xs text-slate-500">{entry.description}</p>
              </div>
              {entry.platformAvailability.available ? (
                <button
                  disabled={busy === entry.id || entry.installState === 'installed'}
                  onClick={() => {
                    setBusy(entry.id);
                    setError(null);
                    void client
                      .installAgent(entry.id)
                      .then((installed) => {
                        setEntries((current) =>
                          current.map((candidate) =>
                            candidate.id === installed.id ? installed : candidate
                          )
                        );
                      })
                      .catch((error: unknown) => {
                        console.error('[AcpCatalogView] Failed to install agent:', error);
                        setError(
                          error instanceof Error ? error.message : 'Failed to install agent'
                        );
                      })
                      .finally(() => setBusy(null));
                  }}
                  type="button"
                >
                  {entry.installState === 'installed' ? 'Installed' : 'Install'}
                </button>
              ) : (
                <span className="text-xs text-slate-500">
                  {entry.platformAvailability.reason ?? 'Unavailable'}
                </span>
              )}
            </div>
            <p className="text-xs">
              {entry.authState === 'authenticated' ? 'Authenticated' : `Auth: ${entry.authState}`}
            </p>
          </article>
        ))}
      </div>
      <label className="block text-sm">
        Profile
        <select
          aria-label="ACP profile"
          className="ml-2 rounded border px-1"
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
    </section>
  );
}
