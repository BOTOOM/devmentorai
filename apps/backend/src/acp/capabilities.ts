import type {
  AcpAgentCapabilities,
  AcpConnectionCapabilities,
  AcpContentBlock,
  AcpPromptCapabilities,
} from '@devmentorai/shared';
import { AcpError } from './errors.js';

export function promptCapabilities(capabilities: AcpConnectionCapabilities): AcpPromptCapabilities {
  return capabilities.agentCapabilities.promptCapabilities ?? {};
}

export function supportsImage(capabilities: AcpConnectionCapabilities): boolean {
  return promptCapabilities(capabilities).image === true;
}

export function supportsAudio(capabilities: AcpConnectionCapabilities): boolean {
  return promptCapabilities(capabilities).audio === true;
}

export function supportsEmbeddedContext(capabilities: AcpConnectionCapabilities): boolean {
  return promptCapabilities(capabilities).embeddedContext === true;
}

export function supportsLoadSession(capabilities: AcpConnectionCapabilities): boolean {
  return capabilities.agentCapabilities.loadSession === true;
}

export function supportsSessionCapability(
  capabilities: AcpConnectionCapabilities,
  name: string
): boolean {
  const sessionCapabilities = capabilities.agentCapabilities.sessionCapabilities;
  return Boolean(sessionCapabilities && name in sessionCapabilities);
}

export function assertPromptCapabilities(
  capabilities: AcpConnectionCapabilities,
  blocks: AcpContentBlock[]
): void {
  for (const block of blocks) {
    if (block.type === 'image' && !supportsImage(capabilities)) {
      throw new AcpError('capability_unsupported', 'Agent did not advertise image prompts', {
        capability: 'promptCapabilities.image',
      });
    }
    if (block.type === 'audio' && !supportsAudio(capabilities)) {
      throw new AcpError('capability_unsupported', 'Agent did not advertise audio prompts', {
        capability: 'promptCapabilities.audio',
      });
    }
    if (block.type === 'resource' && !supportsEmbeddedContext(capabilities)) {
      throw new AcpError(
        'capability_unsupported',
        'Agent did not advertise embedded context prompts',
        { capability: 'promptCapabilities.embeddedContext' }
      );
    }
  }
}

export function normalizeCapabilities(
  value: AcpAgentCapabilities | null | undefined
): AcpAgentCapabilities {
  return value ? { ...value } : {};
}
