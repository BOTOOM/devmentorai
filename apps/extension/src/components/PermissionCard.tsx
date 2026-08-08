import type { AcpPermissionRequest } from '../services/acp-client';

interface PermissionCardProps {
  request: AcpPermissionRequest;
  onRespond: (optionId: string) => void;
  onDismiss: () => void;
}

export function PermissionCard({ request, onRespond, onDismiss }: Readonly<PermissionCardProps>) {
  return (
    <div className="mx-4 mb-3 rounded-lg border border-amber-500/50 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
      <p className="mb-2 font-medium">The agent requests permission</p>
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
      </div>
    </div>
  );
}
