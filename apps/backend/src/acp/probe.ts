import type { AcpContentBlock } from '@devmentorai/shared';
import type { LaunchResolution } from './catalog/types.js';
import { type AcpProbeRequestResult, AgentConnection } from './connection.js';

export type AcpProbeReport = {
  agentId: string;
  profileId: string;
  protocolVersion?: number;
  capabilities?: unknown;
  authMethods: unknown[];
  advertisedCommands: unknown[];
  capabilityMeasurements: {
    image: 'supported' | 'unsupported' | 'unmeasured';
    loadSession: 'supported' | 'unsupported' | 'unmeasured';
  };
  sessionId?: string;
  checks: {
    prompt: AcpProbeRequestResult;
    slashCommand: AcpProbeRequestResult;
    image: AcpProbeRequestResult;
    permission: 'not_applicable' | 'available';
    history: AcpProbeRequestResult;
    cancel: AcpProbeRequestResult;
  };
  verifiedAt: string;
  launchFailure?: string;
};

export async function runConformanceProbe(
  resolution: LaunchResolution,
  cwd: string
): Promise<AcpProbeReport> {
  const connection = new AgentConnection({
    agentId: resolution.profile.agentId ?? resolution.profile.id,
    launchSpec: resolution.launchSpec,
    permissionPolicy: (request) => {
      const reject = request.options.find(
        (option) => option.kind === 'reject_once' || option.kind === 'reject_always'
      );
      return reject
        ? { outcome: { outcome: 'selected', optionId: reject.optionId } }
        : { outcome: { outcome: 'cancelled' } };
    },
  });
  const report: AcpProbeReport = {
    agentId: resolution.profile.agentId ?? resolution.profile.id,
    profileId: resolution.profile.id,
    authMethods: [],
    advertisedCommands: [],
    capabilityMeasurements: {
      image: 'unmeasured',
      loadSession: 'unmeasured',
    },
    checks: {
      prompt: { supported: false, error: { message: 'not run' } },
      slashCommand: { supported: false, error: { message: 'not run' } },
      image: { supported: false, error: { message: 'not run' } },
      permission: 'not_applicable',
      history: { supported: false, error: { message: 'not run' } },
      cancel: { supported: false, error: { message: 'not run' } },
    },
    verifiedAt: new Date().toISOString(),
  };
  try {
    let advertisedCommands: unknown[] = [];
    connection.setSessionUpdateHandler(({ update }) => {
      if (
        update.sessionUpdate === 'available_commands_update' &&
        Array.isArray(update.availableCommands)
      ) {
        advertisedCommands = update.availableCommands;
      }
    });
    const capabilities = await connection.connect();
    report.protocolVersion = capabilities.protocolVersion;
    report.capabilities = capabilities.agentCapabilities;
    report.authMethods = capabilities.authMethods;
    report.capabilityMeasurements = {
      image:
        typeof capabilities.agentCapabilities.promptCapabilities?.image === 'boolean'
          ? capabilities.agentCapabilities.promptCapabilities.image
            ? 'supported'
            : 'unsupported'
          : 'unmeasured',
      loadSession:
        typeof capabilities.agentCapabilities.loadSession === 'boolean'
          ? capabilities.agentCapabilities.loadSession
            ? 'supported'
            : 'unsupported'
          : 'unmeasured',
    };
    const session = await connection.newSession(cwd);
    report.sessionId = session.sessionId;
    report.checks.prompt = await requestPrompt(connection, session.sessionId, 'probe');
    report.checks.slashCommand = await requestPrompt(connection, session.sessionId, '/help');
    const imageBlock: AcpContentBlock = {
      type: 'image',
      mimeType: 'image/png',
      data: 'aGVsbG8=',
    };
    report.checks.image = capabilities.agentCapabilities.promptCapabilities?.image
      ? await requestPrompt(connection, session.sessionId, [imageBlock])
      : { supported: false, error: { message: 'image capability not advertised' } };
    report.checks.permission = 'available';
    report.checks.history = await connection.probeRequest('session/load', {
      sessionId: session.sessionId,
    });
    report.checks.cancel = await connection.probeNotification('session/cancel', {
      sessionId: session.sessionId,
    });
    report.advertisedCommands = advertisedCommands;
  } catch (error) {
    report.checks.prompt = {
      supported: false,
      error: { message: error instanceof Error ? error.message : String(error) },
    };
  } finally {
    await connection.shutdown();
  }
  return report;
}

async function requestPrompt(
  connection: AgentConnection,
  sessionId: string,
  prompt: string | AcpContentBlock[]
): Promise<AcpProbeRequestResult> {
  try {
    const blocks = typeof prompt === 'string' ? [{ type: 'text', text: prompt }] : prompt;
    return { supported: true, value: await connection.prompt(sessionId, blocks) };
  } catch (error) {
    return {
      supported: false,
      error: { message: error instanceof Error ? error.message : String(error) },
    };
  }
}

export function renderSupportTable(reports: AcpProbeReport[]): string {
  const rows = reports.map(
    (report) =>
      `| ${report.agentId} | ${report.protocolVersion ?? 'unmeasured'} | ${report.capabilityMeasurements.loadSession} | ${report.advertisedCommands.length > 0 ? 'supported' : 'unmeasured'} | ${report.capabilityMeasurements.image} | ${report.authMethods.length} |`
  );
  return [
    '<!-- GENERATED ACP SUPPORT TABLE: do not edit manually -->',
    '| Agent | Protocol | History load capability | Advertised commands | Image capability | Auth methods |',
    '| --- | ---: | --- | --- | --- | --- |',
    ...rows,
    '<!-- END GENERATED ACP SUPPORT TABLE -->',
  ].join('\n');
}
