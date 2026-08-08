import fs from 'node:fs/promises';
import path from 'node:path';
import { type AcpProbeReport, runConformanceProbe } from '../apps/backend/src/acp/probe.js';

type Candidate = {
  agentId: string;
  package: string;
  args: string[];
};

const candidates: Candidate[] = [
  { agentId: 'acp-sdk-example', package: '@agentclientprotocol/sdk-example-agent', args: [] },
  { agentId: 'github-copilot-cli', package: '@github/copilot', args: ['--acp', '--stdio'] },
  { agentId: 'claude-acp', package: '@agentclientprotocol/claude-agent-acp', args: [] },
  { agentId: 'codex-acp', package: '@agentclientprotocol/codex-acp', args: [] },
  { agentId: 'gemini-cli', package: '@google/gemini-cli', args: ['--acp'] },
  { agentId: 'qwen-code', package: '@qwen-code/qwen-code', args: ['--acp'] },
];

const cwd = process.cwd();
const reports: AcpProbeReport[] = [];
for (const candidate of candidates) {
  const verifiedAt = new Date().toISOString();
  try {
    const report = await runConformanceProbe(
      {
        profile: {
          id: candidate.agentId,
          name: candidate.agentId,
          agentId: candidate.agentId,
          args: candidate.args,
          env: {},
          defaultCwd: cwd,
          transport: 'stdio',
        },
        launchSpec: {
          cmd: 'npx',
          args: ['--yes', candidate.package, ...candidate.args],
          cwd,
        },
      },
      cwd
    );
    reports.push(
      report.protocolVersion === undefined
        ? {
            ...report,
            launchFailure: report.checks.prompt.error?.message ?? 'agent did not initialize',
          }
        : report
    );
  } catch (error) {
    reports.push({
      agentId: candidate.agentId,
      profileId: candidate.agentId,
      authMethods: [],
      advertisedCommands: [],
      checks: {
        prompt: { supported: false, error: { message: 'agent did not initialize' } },
        slashCommand: { supported: false, error: { message: 'agent did not initialize' } },
        image: { supported: false, error: { message: 'agent did not initialize' } },
        permission: 'not_applicable',
        history: { supported: false, error: { message: 'agent did not initialize' } },
        cancel: { supported: false, error: { message: 'agent did not initialize' } },
      },
      verifiedAt,
      launchFailure: error instanceof Error ? error.message : String(error),
    });
  }
}
await fs.writeFile(
  path.resolve('docs/acp-probe-results.json'),
  `${JSON.stringify(reports, null, 2)}\n`
);
