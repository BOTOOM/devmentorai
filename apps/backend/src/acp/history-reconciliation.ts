export type CachedHistoryMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  source: 'agent' | 'local';
  stale?: boolean;
};

export type RemoteHistoryMessage = Omit<CachedHistoryMessage, 'source' | 'stale'>;

export function reconcileMessages(
  local: CachedHistoryMessage[],
  remote: RemoteHistoryMessage[]
): CachedHistoryMessage[] {
  const remoteIds = new Set(remote.map((message) => message.id));
  const replayed = remote.map((message) => ({ ...message, source: 'agent' as const }));
  const retained = local
    .filter((message) => !remoteIds.has(message.id))
    .map((message) => ({ ...message, stale: true }));
  return [...replayed, ...retained];
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
