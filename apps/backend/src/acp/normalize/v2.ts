import type {
  AcpAvailableCommand,
  AcpConfigOption,
  AcpContentBlock,
  AcpEvent,
  AcpPlanEntry,
  AcpToolCallContent,
  AcpToolCallLocation,
} from '@devmentorai/shared';

type RecordValue = Record<string, unknown>;

export type NormalizeV2Options = {
  messageIds?: Partial<Record<'user' | 'assistant' | 'thought', string>>;
};

function record(value: unknown): RecordValue {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as RecordValue) : {};
}

function content(value: unknown): AcpContentBlock {
  const item = record(value);
  return typeof item.type === 'string'
    ? (item as AcpContentBlock)
    : { type: 'unknown', data: item };
}

function extensions(value: RecordValue): Record<string, unknown> | undefined {
  const result = Object.fromEntries(Object.entries(value).filter(([key]) => key.startsWith('_')));
  return Object.keys(result).length ? result : undefined;
}

function message(
  update: RecordValue,
  role: 'user' | 'assistant' | 'thought',
  mode: 'replace' | 'append',
  options: NormalizeV2Options
): AcpEvent {
  const messageId =
    typeof update.messageId === 'string' ? update.messageId : options.messageIds?.[role];
  if (!messageId) return { type: 'unknown', data: update };
  return {
    type: 'message',
    role,
    messageId,
    content: [content(update.content)],
    mode,
    ...(extensions(update) ? { extensions: extensions(update) } : {}),
  };
}

function toolContent(value: unknown): AcpToolCallContent[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((entry) => {
    const item = record(entry);
    return {
      ...item,
      type: typeof item.type === 'string' ? item.type : 'unknown',
      ...(item.content !== undefined ? { content: content(item.content) } : {}),
    };
  });
}

function tool(update: RecordValue, mode: 'replace' | 'append'): AcpEvent {
  const locations = Array.isArray(update.locations)
    ? update.locations.map((entry) => record(entry) as AcpToolCallLocation)
    : undefined;
  return {
    type: 'tool_call',
    toolCallId: typeof update.toolCallId === 'string' ? update.toolCallId : 'unknown-tool-call',
    ...(typeof update.title === 'string' ? { title: update.title } : {}),
    ...(typeof update.kind === 'string' ? { kind: update.kind } : {}),
    ...(typeof update.status === 'string' ? { status: update.status } : {}),
    ...(toolContent(update.content) ? { content: toolContent(update.content) } : {}),
    ...(locations ? { locations } : {}),
    ...(update.rawInput !== undefined || update.rawOutput !== undefined
      ? {
          raw: {
            ...(update.rawInput !== undefined ? { input: update.rawInput } : {}),
            ...(update.rawOutput !== undefined ? { output: update.rawOutput } : {}),
          },
        }
      : {}),
    mode,
    ...(extensions(update) ? { extensions: extensions(update) } : {}),
  };
}

export function normalizeV2Update(value: unknown, options: NormalizeV2Options = {}): AcpEvent {
  const update = record(value);
  switch (update.sessionUpdate) {
    case 'user_message_chunk':
      return message(update, 'user', 'append', options);
    case 'user_message':
      return message(update, 'user', 'replace', options);
    case 'agent_message_chunk':
      return message(update, 'assistant', 'append', options);
    case 'agent_message':
      return message(update, 'assistant', 'replace', options);
    case 'agent_thought_chunk':
      return message(update, 'thought', 'append', options);
    case 'agent_thought':
      return message(update, 'thought', 'replace', options);
    case 'tool_call_content_chunk':
      return tool(update, 'append');
    case 'tool_call_update':
      return tool(update, 'replace');
    case 'state_update': {
      const state = record(update).state;
      return {
        type: 'state',
        state:
          state === 'running' || state === 'requires_action' || state === 'idle' ? state : 'idle',
        ...(typeof update.stopReason === 'string' ? { stopReason: update.stopReason } : {}),
        ...(extensions(update) ? { extensions: extensions(update) } : {}),
      };
    }
    case 'plan_update': {
      const plan = record(update.plan);
      const entries = Array.isArray(plan.entries)
        ? plan.entries
        : Array.isArray(update.entries)
          ? update.entries
          : [];
      return {
        type: 'plan',
        ...(typeof plan.planId === 'string'
          ? { planId: plan.planId }
          : typeof update.planId === 'string'
            ? { planId: update.planId }
            : {}),
        entries: entries.map((entry) => record(entry) as AcpPlanEntry),
        ...(extensions(update) ? { extensions: extensions(update) } : {}),
      };
    }
    case 'terminal_update':
    case 'terminal_output_chunk':
      return {
        type: 'terminal',
        terminalId: typeof update.terminalId === 'string' ? update.terminalId : 'unknown-terminal',
        ...(typeof update.command === 'string' ? { command: update.command } : {}),
        ...(typeof update.cwd === 'string' ? { cwd: update.cwd } : {}),
        ...(update.data !== undefined
          ? { output: { data: String(update.data), mode: 'append' } }
          : {}),
        ...(typeof update.exitCode === 'number' || update.exitCode === null
          ? { exitStatus: { exitCode: update.exitCode } }
          : {}),
        ...(extensions(update) ? { extensions: extensions(update) } : {}),
      };
    case 'available_commands_update':
      return {
        type: 'commands',
        commands: Array.isArray(update.availableCommands)
          ? update.availableCommands.map((entry) => record(entry) as AcpAvailableCommand)
          : [],
      };
    case 'config_option_update':
      return {
        type: 'config',
        options: Array.isArray(update.configOptions)
          ? update.configOptions.map((entry) => record(entry) as AcpConfigOption)
          : [],
      };
    default:
      return {
        type: 'unknown',
        ...(typeof update.sessionUpdate === 'string'
          ? { sessionUpdate: update.sessionUpdate }
          : {}),
        data: update,
      };
  }
}
