export type CachedHistoryMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  source: 'agent' | 'local';
  timestamp?: string;
  stale?: boolean;
};

export type RemoteHistoryMessage = Omit<CachedHistoryMessage, 'source' | 'stale'>;

export function reconcileMessages(
  local: CachedHistoryMessage[],
  remote: RemoteHistoryMessage[]
): CachedHistoryMessage[] {
  const remoteIds = new Set(remote.map((message) => message.id));
  const replayed = remote.map((message, index) => ({
    ...message,
    timestamp: message.timestamp ?? new Date(index).toISOString(),
    source: 'agent' as const,
  }));
  const retained = local
    .filter((message) => !remoteIds.has(message.id))
    .map((message) => ({ ...message, stale: true }));
  return [...replayed, ...retained].sort(historyOrder);
}

function historyOrder(left: CachedHistoryMessage, right: CachedHistoryMessage): number {
  if (!left.timestamp || !right.timestamp) return 0;
  return left.timestamp.localeCompare(right.timestamp);
}

export type CachedToolCall = {
  id: string;
  status: string;
  title?: string;
  content?: string;
  source: 'agent' | 'local';
  timestamp?: string;
  stale?: boolean;
};

export type RemoteToolCall = Omit<CachedToolCall, 'source' | 'stale'>;

export function reconcileToolCalls(
  local: CachedToolCall[],
  remote: RemoteToolCall[]
): CachedToolCall[] {
  const remoteIds = new Set(remote.map((toolCall) => toolCall.id));
  const replayed = remote.map((toolCall, index) => ({
    ...toolCall,
    timestamp: toolCall.timestamp ?? new Date(index).toISOString(),
    source: 'agent' as const,
  }));
  const retained = local
    .filter((toolCall) => !remoteIds.has(toolCall.id))
    .map((toolCall) => ({ ...toolCall, stale: true }));
  return [...replayed, ...retained].sort((left, right) => {
    if (!left.timestamp || !right.timestamp) return 0;
    return left.timestamp.localeCompare(right.timestamp);
  });
}

export type CachedSession = {
  id: string;
  agentId?: string;
  stale?: boolean;
};

export type RemoteSession = {
  id: string;
  agentId: string;
};

export function reconcileSessions(
  local: CachedSession[],
  remote: RemoteSession[]
): CachedSession[] {
  const remoteById = new Map(remote.map((session) => [session.id, session]));
  const adopted = remote.map((session) => ({ ...session }));
  const stale = local
    .filter((session) => !remoteById.has(session.id))
    .map((session) => ({ ...session, stale: true }));
  return [...adopted, ...stale];
}

export function reconcileSessionsByAgent(
  local: CachedSession[],
  remote: RemoteSession[],
  successfulAgents: ReadonlySet<string>
): Array<CachedSession | RemoteSession> {
  const merged: Array<CachedSession | RemoteSession> = [...remote];
  for (const session of local) {
    if (!session.agentId || !successfulAgents.has(session.agentId)) {
      merged.push(session);
      continue;
    }
    const remoteIds = new Set(
      remote
        .filter((candidate) => candidate.agentId === session.agentId)
        .map((candidate) => candidate.id)
    );
    merged.push({
      ...session,
      ...(remoteIds.has(session.id) ? {} : { stale: true }),
    });
  }
  return merged;
}
