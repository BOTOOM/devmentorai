import type {
  AcpAvailableCommand,
  AcpConfigOption,
  AcpContentBlock,
  AcpEvent,
  AcpPlanEntry,
  AcpToolCallContent,
  AcpToolCallLocation,
  AcpToolCallStatus,
  AcpToolKind,
} from '@devmentorai/shared';

type UnknownRecord = Record<string, unknown>;
export type AcpMessageRole = 'user' | 'assistant' | 'thought';

export type NormalizeV1Options = {
  messageIds?: Partial<Record<AcpMessageRole, string>>;
};

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function extensions(value: UnknownRecord): Record<string, unknown> | undefined {
  const entries = Object.entries(value).filter(([key]) => key.startsWith('_'));
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function contentBlock(value: unknown): AcpContentBlock {
  const data = record(value);
  if (typeof data.type !== 'string') {
    return { type: 'unknown', data };
  }

  return { ...data, type: data.type } as AcpContentBlock;
}

function contentList(value: unknown): AcpContentBlock[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map(contentBlock);
}

function toolContent(value: unknown): AcpToolCallContent[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((item) => {
    const data = record(item);
    return {
      ...data,
      type: stringValue(data.type) ?? 'unknown',
      ...(data.content !== undefined ? { content: contentBlock(data.content) } : {}),
    };
  });
}

function locations(value: unknown): AcpToolCallLocation[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((item) => record(item) as AcpToolCallLocation);
}

function optionalStringRecord(
  value: UnknownRecord,
  key: string
): Record<string, unknown> | undefined {
  const result = value[key];
  return result && typeof result === 'object' && !Array.isArray(result)
    ? (result as Record<string, unknown>)
    : undefined;
}

function messageEvent(
  update: UnknownRecord,
  role: AcpMessageRole,
  mode: 'replace' | 'append',
  options: NormalizeV1Options
): AcpEvent {
  const messageId = stringValue(update.messageId) ?? options.messageIds?.[role];
  if (!messageId) {
    return {
      type: 'unknown',
      ...(stringValue(update.sessionUpdate)
        ? { sessionUpdate: stringValue(update.sessionUpdate) }
        : {}),
      data: update,
    };
  }
  const content = contentBlock(update.content);
  return {
    type: 'message',
    role,
    messageId,
    content: [content],
    mode,
    ...(extensions(update) ? { extensions: extensions(update) } : {}),
  };
}

function nullableStringField(
  update: UnknownRecord,
  key: string
): { value: string | null } | undefined {
  if (!Object.prototype.hasOwnProperty.call(update, key)) return undefined;
  const value = update[key];
  return value === null || typeof value === 'string' ? { value } : undefined;
}

function toolEvent(update: UnknownRecord): AcpEvent {
  const rawInput = update.rawInput;
  const rawOutput = update.rawOutput;
  return {
    type: 'tool_call',
    toolCallId: stringValue(update.toolCallId) ?? 'unknown-tool-call',
    ...(stringValue(update.title) ? { title: update.title as string } : {}),
    ...(typeof update.kind === 'string' ? { kind: update.kind as AcpToolKind } : {}),
    ...(typeof update.status === 'string' ? { status: update.status as AcpToolCallStatus } : {}),
    ...(toolContent(update.content) ? { content: toolContent(update.content) } : {}),
    ...(locations(update.locations) ? { locations: locations(update.locations) } : {}),
    ...(rawInput !== undefined || rawOutput !== undefined
      ? {
          raw: {
            ...(rawInput !== undefined ? { input: rawInput } : {}),
            ...(rawOutput !== undefined ? { output: rawOutput } : {}),
          },
        }
      : {}),
    mode: 'replace',
    ...(extensions(update) ? { extensions: extensions(update) } : {}),
  };
}

export function normalizeV1Update(value: unknown, options: NormalizeV1Options = {}): AcpEvent {
  const update = record(value);
  const variant = stringValue(update.sessionUpdate);
  switch (variant) {
    case 'user_message_chunk':
      return messageEvent(update, 'user', 'append', options);
    case 'agent_message_chunk':
      return messageEvent(update, 'assistant', 'append', options);
    case 'agent_thought_chunk':
      return messageEvent(update, 'thought', 'append', options);
    case 'tool_call':
    case 'tool_call_update':
      return toolEvent(update);
    case 'plan':
      return {
        type: 'plan',
        entries: Array.isArray(update.entries)
          ? update.entries.map((entry) => record(entry) as AcpPlanEntry)
          : [],
        ...(extensions(update) ? { extensions: extensions(update) } : {}),
      };
    case 'available_commands_update':
      return {
        type: 'commands',
        commands: Array.isArray(update.availableCommands)
          ? update.availableCommands.map((command) => record(command) as AcpAvailableCommand)
          : [],
        ...(extensions(update) ? { extensions: extensions(update) } : {}),
      };
    case 'config_option_update':
      return {
        type: 'config',
        options: Array.isArray(update.configOptions)
          ? update.configOptions.map((option) => record(option) as AcpConfigOption)
          : [],
        ...(extensions(update) ? { extensions: extensions(update) } : {}),
      };
    case 'session_info_update': {
      const title = nullableStringField(update, 'title');
      const updatedAt = nullableStringField(update, 'updatedAt');
      return {
        type: 'session_info',
        ...(title ? { title: title.value } : {}),
        ...(updatedAt ? { updatedAt: updatedAt.value } : {}),
        ...(extensions(update) ? { extensions: extensions(update) } : {}),
      };
    }
    case 'usage_update': {
      const used = numberValue(update.used) ?? 0;
      const size = numberValue(update.size) ?? 0;
      const cost = optionalStringRecord(update, 'cost');
      return {
        type: 'usage',
        used,
        size,
        ...(cost && typeof cost.amount === 'number' && typeof cost.currency === 'string'
          ? { cost: { amount: cost.amount, currency: cost.currency } }
          : {}),
        ...(extensions(update) ? { extensions: extensions(update) } : {}),
      };
    }
    default:
      return {
        type: 'unknown',
        ...(variant ? { sessionUpdate: variant } : {}),
        data: update,
      };
  }
}
