export type AcpToolKind =
  | 'read'
  | 'edit'
  | 'delete'
  | 'move'
  | 'search'
  | 'execute'
  | 'think'
  | 'fetch'
  | 'switch_mode'
  | 'other'
  | (string & {});

export type AcpToolCallStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | (string & {});

export type AcpStopReason =
  | 'end_turn'
  | 'max_tokens'
  | 'max_turn_requests'
  | 'refusal'
  | 'cancelled'
  | (string & {});

export type AcpContentBlock =
  | {
      type: 'text';
      text: string;
      [key: string]: unknown;
    }
  | {
      type: 'image';
      data: string;
      mimeType: string;
      uri?: string | null;
      [key: string]: unknown;
    }
  | {
      type: 'audio';
      data: string;
      mimeType: string;
      [key: string]: unknown;
    }
  | {
      type: 'resource';
      resource: {
        uri: string;
        mimeType?: string | null;
        text?: string;
        blob?: string;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    }
  | {
      type: 'resource_link';
      uri: string;
      name?: string;
      mimeType?: string | null;
      size?: number | null;
      [key: string]: unknown;
    }
  | {
      type: string;
      [key: string]: unknown;
    };

export type AcpToolCallContent = {
  type: string;
  content?: AcpContentBlock;
  [key: string]: unknown;
};

export type AcpToolCallLocation = {
  path: string;
  line?: number | null;
  [key: string]: unknown;
};

export type AcpPlanEntry = {
  content: string;
  priority: string;
  status: string;
  [key: string]: unknown;
};

export type AcpAvailableCommand = {
  name: string;
  description: string;
  input?: {
    hint?: string;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

export type AcpConfigOption = {
  id: string;
  name: string;
  category?: string | null;
  type: string;
  currentValue?: string | boolean | null;
  options?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export type AcpUsageCost = {
  amount: number;
  currency: string;
};

export type AcpErrorCode =
  | 'agent_not_installed'
  | 'agent_launch_failed'
  | 'agent_crashed'
  | 'protocol_version_unsupported'
  | 'auth_required'
  | 'capability_unsupported'
  | 'permission_denied'
  | 'cancelled'
  | 'agent_error';

export type AcpErrorPayload = {
  code: AcpErrorCode;
  message: string;
  details?: Record<string, unknown>;
};

export type AcpEvent =
  | {
      type: 'message';
      role: 'user' | 'assistant' | 'thought';
      messageId: string;
      content: AcpContentBlock[];
      mode: 'replace' | 'append';
      extensions?: Record<string, unknown>;
    }
  | {
      /**
       * Consumers merge tool-call events field-wise: omitted fields are unchanged,
       * present content replaces the previous array, and append mode appends content.
       */
      type: 'tool_call';
      toolCallId: string;
      title?: string;
      kind?: AcpToolKind;
      status?: AcpToolCallStatus;
      content?: AcpToolCallContent[];
      locations?: AcpToolCallLocation[];
      raw?: {
        input?: unknown;
        output?: unknown;
      };
      mode: 'replace' | 'append';
      extensions?: Record<string, unknown>;
    }
  | {
      type: 'terminal';
      terminalId: string;
      command?: string;
      cwd?: string;
      output?: {
        data: string;
        mode: 'snapshot' | 'append';
      };
      exitStatus?: {
        exitCode?: number | null;
        signal?: string | null;
      };
      extensions?: Record<string, unknown>;
    }
  | {
      type: 'plan';
      planId?: string;
      entries: AcpPlanEntry[];
      extensions?: Record<string, unknown>;
    }
  | {
      type: 'commands';
      commands: AcpAvailableCommand[];
      extensions?: Record<string, unknown>;
    }
  | {
      type: 'config';
      options: AcpConfigOption[];
      extensions?: Record<string, unknown>;
    }
  | {
      type: 'session_info';
      title?: string | null;
      updatedAt?: string | null;
      extensions?: Record<string, unknown>;
    }
  | {
      type: 'usage';
      used: number;
      size: number;
      cost?: AcpUsageCost;
      extensions?: Record<string, unknown>;
    }
  | {
      type: 'state';
      state: 'running' | 'idle' | 'requires_action';
      stopReason?: AcpStopReason;
      extensions?: Record<string, unknown>;
    }
  | {
      type: 'error';
      error: AcpErrorPayload;
    }
  | {
      type: 'unknown';
      sessionUpdate?: string;
      data: Record<string, unknown>;
    };

export type AcpPromptCapabilities = {
  image?: boolean;
  audio?: boolean;
  embeddedContext?: boolean;
  [key: string]: unknown;
};

export type AcpAgentCapabilities = {
  loadSession?: boolean;
  elicitation?: boolean;
  promptCapabilities?: AcpPromptCapabilities;
  sessionCapabilities?: Record<string, unknown>;
  [key: string]: unknown;
};

export type AcpAuthMethod = {
  id: string;
  name: string;
  description: string;
  [key: string]: unknown;
};

export type AcpConnectionCapabilities = {
  protocolVersion: number;
  agentCapabilities: AcpAgentCapabilities;
  authMethods: AcpAuthMethod[];
  agentInfo?: Record<string, unknown>;
};

export type AcpSessionRecord = {
  id: string;
  agentId: string;
  acpSessionId: string;
  cwd: string;
  protocolVersion: number;
  capabilities: AcpConnectionCapabilities;
  configOptions?: AcpConfigOption[];
};
