import type { AcpPermissionRequest } from '../services/acp-client';

interface PermissionCardProps {
  request: AcpPermissionRequest;
  onRespond: (optionId: string) => void;
  onDismiss: () => void;
  onRevoke?: () => void;
}

export function PermissionCard({
  request,
  onRespond,
  onDismiss,
  onRevoke,
}: Readonly<PermissionCardProps>) {
  return (
    <div className="mx-4 mb-3 rounded-lg border border-amber-500/50 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
      <p className="mb-1 font-medium">The agent requests permission</p>
      {request.toolCall && typeof request.toolCall === 'object' ? (
        <p className="mb-2 text-xs text-slate-600 dark:text-slate-300">
          {String((request.toolCall as Record<string, unknown>).title ?? 'Tool action')}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {request.options.map((option) => (
          <button
            className="rounded border border-amber-600 px-2 py-1 hover:bg-amber-100 dark:hover:bg-amber-900"
            key={option.optionId}
            onClick={() => onRespond(option.optionId)}
            type="button"
          >
            {option.name}
          </button>
        ))}
        <button
          className="rounded border border-slate-400 px-2 py-1"
          onClick={onDismiss}
          type="button"
        >
          Dismiss
        </button>
        {onRevoke ? (
          <button
            className="rounded border border-slate-400 px-2 py-1"
            onClick={onRevoke}
            type="button"
          >
            Forget remembered choice
          </button>
        ) : null}
      </div>
    </div>
  );
}
