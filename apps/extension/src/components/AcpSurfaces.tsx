import type { AcpConfigOption } from '@devmentorai/shared';
import type { AcpChatState } from '../services/acp-reducer';

type AcpSurfacesProps = {
  state: AcpChatState;
  onConfigChange?: (option: AcpConfigOption, value: string | boolean) => void;
};

export function AcpSurfaces({ state, onConfigChange }: Readonly<AcpSurfacesProps>) {
  return (
    <div className="space-y-2">
      {state.usage ? (
        <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          Context: {state.usage.used.toLocaleString()} / {state.usage.size.toLocaleString()} tokens
        </div>
      ) : null}

      {state.configOptions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {state.configOptions.map((option) => (
            <label className="flex items-center gap-1 text-xs" key={option.id}>
              <span className="text-slate-500">{option.name}</span>
              <select
                className="rounded border border-slate-300 bg-white px-1 py-1 dark:border-slate-600 dark:bg-slate-800"
                value={String(option.currentValue ?? '')}
                onChange={(event) =>
                  onConfigChange?.(
                    option,
                    option.type === 'boolean' ? event.target.value === 'true' : event.target.value
                  )
                }
              >
                {(option.options ?? []).map((candidate) => {
                  const value = String(candidate.value ?? candidate.id ?? '');
                  return (
                    <option key={value} value={value}>
                      {String(candidate.name ?? value)}
                    </option>
                  );
                })}
                {option.currentValue !== undefined &&
                !(option.options ?? []).some(
                  (candidate) =>
                    String(candidate.value ?? candidate.id ?? '') === String(option.currentValue)
                ) ? (
                  <option value={String(option.currentValue)}>{String(option.currentValue)}</option>
                ) : null}
                {option.type === 'boolean' && !(option.options ?? []).length ? (
                  <>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </>
                ) : null}
              </select>
            </label>
          ))}
        </div>
      ) : null}

      {state.plan.length > 0 ? (
        <div className="rounded border border-slate-200 p-3 dark:border-slate-700">
          <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Plan</p>
          <ul className="space-y-1 text-sm">
            {state.plan.map((entry, index) => (
              <li className="flex items-center gap-2" key={`${entry.content}-${index}`}>
                <span aria-hidden="true">{entry.status === 'completed' ? '☑' : '☐'}</span>
                <span>{entry.content}</span>
                <span className="ml-auto text-xs text-slate-500">{entry.priority}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {state.toolCalls.map((tool) => (
        <details
          className="rounded border border-slate-200 p-3 text-sm dark:border-slate-700"
          key={tool.toolCallId}
        >
          <summary className="cursor-pointer">
            <span className="font-medium">{tool.title ?? tool.toolCallId}</span>
            <span className="ml-2 text-xs text-slate-500">
              {tool.kind ?? 'unknown'} · {tool.status ?? 'unknown'}
            </span>
          </summary>
          {tool.locations?.map((location) => (
            <div
              className="mt-1 text-xs text-slate-500"
              key={`${location.path}-${location.line ?? 0}`}
            >
              {location.path}
              {location.line ? `:${location.line}` : ''}
            </div>
          ))}
          {tool.content?.map((content) =>
            content.type === 'diff' ? (
              <div
                className="mt-2 overflow-x-auto rounded bg-slate-100 p-2 text-xs dark:bg-slate-900"
                key={JSON.stringify(content)}
              >
                <div className="text-slate-500">{String(content.path ?? 'diff')}</div>
                <pre className="text-red-700">
                  {String(content.oldText ?? content.before ?? '')}
                </pre>
                <pre className="text-green-700">
                  {String(content.newText ?? content.after ?? '')}
                </pre>
              </div>
            ) : (
              <pre
                className="mt-2 overflow-x-auto rounded bg-slate-100 p-2 text-xs dark:bg-slate-900"
                key={JSON.stringify(content)}
              >
                {JSON.stringify(content, null, 2)}
              </pre>
            )
          )}
          {tool.raw ? (
            <pre className="mt-2 overflow-x-auto rounded bg-slate-100 p-2 text-xs dark:bg-slate-900">
              {JSON.stringify(tool.raw, null, 2)}
            </pre>
          ) : null}
        </details>
      ))}

      {state.errors.map((event, index) => (
        <div
          className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200"
          key={`${event.error.code}-${index}`}
        >
          <strong>{event.error.code}</strong>: {event.error.message}
          {event.error.code === 'agent_crashed' ? (
            <span className="ml-2">Restart the session to try again.</span>
          ) : null}
          {event.error.code === 'auth_required' && event.error.details?.authMethods ? (
            <ul className="mt-1 list-disc pl-5">
              {(
                event.error.details.authMethods as Array<{ id?: unknown; description?: unknown }>
              ).map((method, index) => (
                <li key={`${String(method.id ?? 'method')}-${index}`}>
                  {String(method.id ?? '')}
                  {method.description ? `: ${String(method.description)}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}

      {state.events
        .filter((event) => event.type === 'unknown' || event.type === 'terminal')
        .map((event, index) => (
          <details
            className="rounded border border-slate-200 p-2 text-xs dark:border-slate-700"
            key={`${event.type}-${index}`}
          >
            <summary>Additional agent update: {event.type}</summary>
            <pre className="mt-2 overflow-x-auto">{JSON.stringify(event, null, 2)}</pre>
          </details>
        ))}
    </div>
  );
}
