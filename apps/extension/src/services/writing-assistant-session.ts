/**
 * ACP-backed writing assistant session used by quick actions.
 */

import type { AcpEvent, AcpSessionRecord, Session } from '@devmentorai/shared';
import { AcpClient } from './acp-client';

const WRITING_ASSISTANT_SESSION_NAME = 'Writing Assistant';
const WRITING_ASSISTANT_SESSION_TYPE = 'writing';

let cachedSession: Session | null = null;
let cachedAcpSession: AcpSessionRecord | null = null;

const acpClient = new AcpClient({ url: 'ws://127.0.0.1:3847/acp' });

function toSession(record: AcpSessionRecord): Session {
  const modelOption = record.configOptions?.find((option) => option.id === 'model');
  const model =
    typeof modelOption?.currentValue === 'string' ? modelOption.currentValue : 'configured';
  return {
    id: record.id,
    name: WRITING_ASSISTANT_SESSION_NAME,
    type: WRITING_ASSISTANT_SESSION_TYPE,
    status: 'active',
    model,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messageCount: 0,
    agentId: record.agentId,
    acpSessionId: record.acpSessionId,
    cwd: record.cwd,
    protocolVersion: record.protocolVersion,
    capabilities: record.capabilities,
    configOptions: record.configOptions,
    replaySupported: record.capabilities.agentCapabilities.loadSession === true,
  };
}

function textFromEvent(event: AcpEvent): string {
  if (event.type !== 'message') return '';
  return event.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

export async function getOrCreateWritingAssistantSession(_model?: string): Promise<Session | null> {
  if (cachedSession && cachedAcpSession) return cachedSession;
  try {
    await acpClient.connect();
    const record = await acpClient.createSession(undefined, '.');
    cachedAcpSession = record;
    cachedSession = toSession(record);
    return cachedSession;
  } catch {
    return null;
  }
}

export function isWritingAssistantSession(session: Session): boolean {
  return (
    session.name === WRITING_ASSISTANT_SESSION_NAME &&
    session.type === WRITING_ASSISTANT_SESSION_TYPE
  );
}

export function getWritingAssistantSessionName(): string {
  return WRITING_ASSISTANT_SESSION_NAME;
}

export function clearWritingAssistantCache(): void {
  cachedSession = null;
  cachedAcpSession = null;
}

export async function streamQuickAction(
  prompt: string,
  onEvent: (event: { type: string; content?: string; error?: string }) => void,
  signal?: AbortSignal
): Promise<void> {
  const session = await getOrCreateWritingAssistantSession();
  if (!session || !cachedAcpSession) {
    onEvent({ type: 'error', error: 'Failed to create ACP writing assistant session' });
    return;
  }

  let content = '';
  const unsubscribe = acpClient.onEvent((sessionId, _sequence, event) => {
    if (sessionId !== session.id) return;
    if (event.type === 'state' && event.state === 'running') onEvent({ type: 'start' });
    if (event.type === 'message' && event.role === 'assistant') {
      const next = textFromEvent(event);
      content = event.mode === 'append' ? `${content}${next}` : next;
      onEvent({ type: 'delta', content });
    }
    if (event.type === 'state' && event.state === 'idle') onEvent({ type: 'complete', content });
    if (event.type === 'error') onEvent({ type: 'error', error: event.error.message });
  });

  const abort = () => {
    void acpClient.cancel(session.id);
  };
  signal?.addEventListener('abort', abort, { once: true });
  try {
    await acpClient.prompt(session.id, prompt);
  } catch (error) {
    onEvent({
      type: 'error',
      error: error instanceof Error ? error.message : 'ACP prompt failed',
    });
  } finally {
    signal?.removeEventListener('abort', abort);
    unsubscribe();
  }
}
