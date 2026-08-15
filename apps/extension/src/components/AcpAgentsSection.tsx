import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AcpCatalogEntry, AcpClient, AcpProfile } from '../services/acp-client';
import { AcpProfileEditor } from './AcpProfileEditor';

type AcpAgentsSectionProps = {
  client: AcpClient;
  /** Rendered inside the options page card by default; the side panel passes `compact`. */
  compact?: boolean;
};

type AgentState = 'enabled' | 'auth_required' | 'unavailable' | 'available';

function agentState(entry: AcpCatalogEntry): AgentState {
  if (!entry.platformAvailability.available) return 'unavailable';
  if (entry.authState === 'required') return 'auth_required';
  return entry.enabled ? 'enabled' : 'available';
}

const STATE_LABEL: Record<AgentState, string> = {
  enabled: 'Enabled',
  auth_required: 'Auth required',
  unavailable: 'Unavailable',
  available: 'Not enabled',
};

const STATE_BADGE: Record<AgentState, string> = {
  enabled: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
  auth_required: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  unavailable: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  available: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
};

const FOCUS_RING =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-800';

function AgentIcon({ entry }: Readonly<{ entry: AcpCatalogEntry }>) {
  const [broken, setBroken] = useState(false);
  if (entry.icon && !broken) {
    return (
      <img
        alt=""
        className="h-8 w-8 rounded-md object-contain bg-gray-100 dark:bg-gray-700"
        onError={() => setBroken(true)}
        src={entry.icon}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-200 text-sm font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200"
    >
      {entry.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Token field driven by the agent's declared environment variables. */
function AgentAuthForm({
  client,
  entry,
  onDone,
}: Readonly<{
  client: AcpClient;
  entry: AcpCatalogEntry;
  onDone: () => void;
}>) {
  const envVars = entry.auth?.envVars ?? [];
  const [envVar, setEnvVar] = useState(envVars[0] ?? '');
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  // Rendered next to the field that caused it; the section-level alert is too far away.
  const [formError, setFormError] = useState<string | null>(null);
  const inputId = `acp-token-${entry.id}`;
  const selectId = `acp-token-env-${entry.id}`;

  return (
    <form
      className="mt-3 space-y-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50"
      onSubmit={(event) => {
        event.preventDefault();
        setSaving(true);
        setFormError(null);
        void client
          .setAgentToken(entry.id, token, envVar || undefined)
          .then(() => {
            setToken('');
            onDone();
          })
          .catch((error: unknown) => {
            setFormError(error instanceof Error ? error.message : 'Failed to store the token');
          })
          .finally(() => setSaving(false));
      }}
    >
      <p className="text-xs text-gray-600 dark:text-gray-300">
        The token is stored encrypted by the backend and injected into the agent process. It is
        never kept in the extension.
      </p>
      {envVars.length > 1 ? (
        <div>
          <label
            className="block text-xs font-medium text-gray-700 dark:text-gray-300"
            htmlFor={selectId}
          >
            Environment variable
          </label>
          <select
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            id={selectId}
            onChange={(event) => setEnvVar(event.target.value)}
            value={envVar}
          >
            {envVars.map((variable) => (
              <option key={variable} value={variable}>
                {variable}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div>
        <label
          className="block text-xs font-medium text-gray-700 dark:text-gray-300"
          htmlFor={inputId}
        >
          {envVars[0] ? `Token for ${envVars[0]}` : 'Token'}
        </label>
        <input
          autoComplete="off"
          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          id={inputId}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Paste a token"
          type="password"
          value={token}
        />
      </div>
      {entry.auth?.scopes?.length ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Required permissions: {entry.auth.scopes.join(', ')}
        </p>
      ) : null}
      {entry.auth?.notes ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">{entry.auth.notes}</p>
      ) : null}
      {formError ? (
        <p className="text-xs font-medium text-red-700 dark:text-red-300" role="alert">
          {formError}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <button
          className={`rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${FOCUS_RING}`}
          disabled={saving || token.length === 0}
          type="submit"
        >
          {saving ? 'Saving…' : 'Save token'}
        </button>
        {entry.auth?.tokenUrl ? (
          <a
            className={`text-sm text-primary-600 hover:underline dark:text-primary-400 ${FOCUS_RING}`}
            href={entry.auth.tokenUrl}
            rel="noreferrer"
            target="_blank"
          >
            Create a token
          </a>
        ) : null}
        {envVar ? (
          <button
            className={`text-sm text-gray-600 hover:underline dark:text-gray-300 ${FOCUS_RING}`}
            onClick={() => {
              void client
                .clearAgentToken(entry.id, envVar)
                .then(onDone)
                .catch(() => setFormError('Failed to remove the token'));
            }}
            type="button"
          >
            Remove
          </button>
        ) : null}
      </div>
      {entry.auth?.localLogin ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Alternatively, log in locally with <code>{entry.auth.localLogin}</code>.
        </p>
      ) : null}
      {entry.authMethods.length > 0 ? (
        <ul className="space-y-1">
          {entry.authMethods.map((method) => (
            <li key={method.id}>
              <button
                className={`text-sm text-primary-600 hover:underline dark:text-primary-400 ${FOCUS_RING}`}
                onClick={() => {
                  const profileId = entry.profileId;
                  if (!profileId) {
                    setFormError('Enable the agent before authenticating');
                    return;
                  }
                  void client
                    .authenticateAgent(profileId, method.id)
                    .then(onDone)
                    .catch((error: unknown) => {
                      setFormError(
                        error instanceof Error ? error.message : 'Authentication failed'
                      );
                    });
                }}
                type="button"
              >
                {method.description || method.id}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}

/**
 * One-click agent management: every catalog agent is listed and `Enable` creates
 * the implicit profile, so nothing has to be configured by hand. Advanced profile
 * fields stay reachable behind the per-agent menu.
 */
export function AcpAgentsSection({ client, compact = false }: Readonly<AcpAgentsSectionProps>) {
  const [entries, setEntries] = useState<AcpCatalogEntry[]>([]);
  const [profiles, setProfiles] = useState<AcpProfile[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [probe, setProbe] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [nextEntries, nextProfiles] = await Promise.all([
      client.listAgents(),
      client.listProfiles(),
    ]);
    setEntries(nextEntries);
    setProfiles(nextProfiles);
    setError(null);
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

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matching = needle
      ? entries.filter((entry) =>
          `${entry.name} ${entry.description ?? ''}`.toLowerCase().includes(needle)
        )
      : entries;
    return [...matching].sort((left, right) => {
      if (Boolean(left.default) !== Boolean(right.default)) return left.default ? -1 : 1;
      if (Boolean(left.enabled) !== Boolean(right.enabled)) return left.enabled ? -1 : 1;
      return left.name.localeCompare(right.name);
    });
  }, [entries, query]);

  const run = (id: string, action: Promise<unknown>, failure: string) => {
    setBusy(id);
    setError(null);
    void action
      .then(() => refresh())
      .catch((actionError: unknown) => {
        setError(actionError instanceof Error ? actionError.message : failure);
      })
      .finally(() => setBusy(null));
  };

  return (
    <section aria-label="ACP agents" className="space-y-3">
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
          className="flex items-start justify-between gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200"
          role="alert"
        >
          <p>{error}</p>
          <button className={`font-medium underline ${FOCUS_RING}`} onClick={reload} type="button">
            Retry
          </button>
        </div>
      ) : null}

      {loading ? <p className="text-sm text-gray-500 dark:text-gray-400">Loading agents…</p> : null}

      {!loading && !error && filtered.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No agent matches “{query}”.</p>
      ) : null}

      <ul className="space-y-2">
        {filtered.map((entry) => {
          const state = agentState(entry);
          const isBusy = busy === entry.id;
          return (
            <li
              className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
              key={entry.id}
            >
              <div className="flex items-start gap-3">
                <AgentIcon entry={entry} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-medium text-gray-900 dark:text-white">
                      {entry.name}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATE_BADGE[state]}`}
                    >
                      {STATE_LABEL[state]}
                    </span>
                  </div>
                  {entry.description && !compact ? (
                    <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
                      {entry.description}
                    </p>
                  ) : null}
                  {state === 'unavailable' && entry.platformAvailability.reason ? (
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {entry.platformAvailability.reason}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    aria-label={entry.default ? 'Default agent' : `Make ${entry.name} the default`}
                    aria-pressed={Boolean(entry.default)}
                    className={`rounded p-1 text-lg leading-none ${
                      entry.default
                        ? 'text-amber-500'
                        : 'text-gray-400 hover:text-amber-500 dark:text-gray-500'
                    } disabled:opacity-40 ${FOCUS_RING}`}
                    disabled={!entry.enabled || isBusy}
                    onClick={() =>
                      run(
                        entry.id,
                        client.setDefaultAgent(entry.id),
                        'Failed to set the default agent'
                      )
                    }
                    type="button"
                  >
                    {entry.default ? '★' : '☆'}
                  </button>
                  {state === 'unavailable' ? null : entry.enabled ? (
                    <button
                      className={`rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700 ${FOCUS_RING}`}
                      disabled={isBusy}
                      onClick={() =>
                        run(entry.id, client.disableAgent(entry.id), 'Failed to disable the agent')
                      }
                      type="button"
                    >
                      {isBusy ? 'Working…' : 'Disable'}
                    </button>
                  ) : (
                    <button
                      className={`rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 ${FOCUS_RING}`}
                      disabled={isBusy}
                      onClick={() =>
                        run(entry.id, client.enableAgent(entry.id), 'Failed to enable the agent')
                      }
                      type="button"
                    >
                      {isBusy ? 'Enabling…' : 'Enable'}
                    </button>
                  )}
                  <button
                    aria-expanded={expanded === entry.id}
                    aria-label={`More options for ${entry.name}`}
                    className={`rounded p-1 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white ${FOCUS_RING}`}
                    onClick={() =>
                      setExpanded((current) => (current === entry.id ? null : entry.id))
                    }
                    type="button"
                  >
                    ⋯
                  </button>
                </div>
              </div>

              {expanded === entry.id ? (
                <div className="mt-3 space-y-3 border-t border-gray-200 pt-3 dark:border-gray-700">
                  {entry.auth || entry.authState === 'required' || entry.authMethods.length > 0 ? (
                    <AgentAuthForm client={client} entry={entry} onDone={reload} />
                  ) : null}
                  <details>
                    <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-200">
                      Advanced profile (command, arguments, TCP, working directory)
                    </summary>
                    <div className="mt-2">
                      <AcpProfileEditor
                        client={client}
                        onSaved={reload}
                        profile={profiles.find(
                          (profile) =>
                            profile.id === entry.profileId || profile.agentId === entry.id
                        )}
                      />
                    </div>
                  </details>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      className={`text-sm text-primary-600 hover:underline disabled:opacity-50 dark:text-primary-400 ${FOCUS_RING}`}
                      disabled={!entry.profileId || isBusy}
                      onClick={() => {
                        const profileId = entry.profileId;
                        if (!profileId) return;
                        setBusy(entry.id);
                        setProbe(null);
                        void client
                          .probeAgent(profileId)
                          .then((report) => setProbe(JSON.stringify(report, null, 2)))
                          .catch((probeError: unknown) => {
                            setError(
                              probeError instanceof Error
                                ? probeError.message
                                : 'Conformance probe failed'
                            );
                          })
                          .finally(() => setBusy(null));
                      }}
                      type="button"
                    >
                      Run conformance probe
                    </button>
                    <button
                      className={`text-sm text-red-700 hover:underline dark:text-red-300 ${FOCUS_RING}`}
                      onClick={() =>
                        run(
                          entry.id,
                          client.uninstallAgent(entry.id),
                          'Failed to uninstall the agent'
                        )
                      }
                      type="button"
                    >
                      Uninstall
                    </button>
                  </div>
                  {probe ? (
                    <pre className="max-h-48 overflow-auto rounded bg-gray-900 p-2 text-xs text-gray-100">
                      {probe}
                    </pre>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
