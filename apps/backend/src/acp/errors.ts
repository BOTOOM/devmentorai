import type { AcpErrorCode, AcpErrorPayload } from '@devmentorai/shared';

export type { AcpErrorCode, AcpErrorPayload };

export class AcpError extends Error {
  readonly code: AcpErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: AcpErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'AcpError';
    this.code = code;
    this.details = details;
  }

  toPayload(): AcpErrorPayload {
    return {
      code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export function isAcpError(error: unknown): error is AcpError {
  return error instanceof AcpError;
}

export function toAcpError(
  error: unknown,
  context: { startup?: boolean; processExited?: boolean; agentId?: string } = {}
): AcpError {
  if (error instanceof AcpError) return error;

  const candidate = error as {
    code?: unknown;
    message?: unknown;
    data?: unknown;
  };
  const message = typeof candidate.message === 'string' ? candidate.message : String(error);
  const code = candidate.code;
  const details =
    candidate.data && typeof candidate.data === 'object' && !Array.isArray(candidate.data)
      ? (candidate.data as Record<string, unknown>)
      : undefined;

  if (code === -32601) {
    return new AcpError('capability_unsupported', message, {
      ...(details ?? {}),
      jsonRpcCode: code,
    });
  }

  if (code === -32000 || /authentication required|auth required/i.test(message)) {
    return new AcpError('auth_required', message, {
      ...(details ?? {}),
      jsonRpcCode: typeof code === 'number' ? code : undefined,
    });
  }

  if (context.processExited) {
    return new AcpError('agent_crashed', message, {
      ...(details ?? {}),
      agentId: context.agentId,
    });
  }

  if (context.startup) {
    return new AcpError('agent_launch_failed', message, {
      ...(details ?? {}),
      agentId: context.agentId,
    });
  }

  return new AcpError('agent_error', message, {
    ...(details ?? {}),
    jsonRpcCode: typeof code === 'number' ? code : undefined,
  });
}
