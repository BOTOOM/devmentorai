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
    report.checks.cancel = await connection.probeRequest('session/cancel', {
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
      `| ${report.agentId} | ${report.protocolVersion ?? 'unknown'} | ${report.checks.history.supported ? 'yes' : 'no'} | ${report.advertisedCommands.length > 0 ? 'yes' : 'no'} | ${report.checks.image.supported ? 'yes' : 'no'} | ${report.authMethods.length} |`
  );
  return [
    '<!-- GENERATED ACP SUPPORT TABLE: do not edit manually -->',
    '| Agent | Protocol | History load | Advertised commands | Images | Auth methods |',
    '| --- | ---: | --- | --- | --- | --- |',
    ...rows,
    '<!-- END GENERATED ACP SUPPORT TABLE -->',
  ].join('\n');
}
