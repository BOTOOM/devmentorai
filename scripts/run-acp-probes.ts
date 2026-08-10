import fs from 'node:fs/promises';
import path from 'node:path';
import { type AcpProbeReport, runConformanceProbe } from '../apps/backend/src/acp/probe.js';

type Candidate = {
  agentId: string;
  cmd: string;
  args: string[];
};

const candidates: Candidate[] = [
  {
    agentId: 'acp-sdk-example',
    cmd: 'node',
    args: ['/home/ubuntu/acp-spike/node_modules/@agentclientprotocol/sdk/dist/examples/agent.js'],
  },
  {
    agentId: 'github-copilot-cli',
    cmd: 'npx',
    args: ['--yes', '@github/copilot', '--acp', '--stdio'],
  },
  { agentId: 'claude-acp', cmd: 'npx', args: ['--yes', '@agentclientprotocol/claude-agent-acp'] },
  { agentId: 'codex-acp', cmd: 'npx', args: ['--yes', '@agentclientprotocol/codex-acp'] },
  { agentId: 'gemini-cli', cmd: 'npx', args: ['--yes', '@google/gemini-cli', '--acp'] },
  { agentId: 'qwen-code', cmd: 'npx', args: ['--yes', '@qwen-code/qwen-code', '--acp'] },
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
          cmd: candidate.cmd,
          args: candidate.args,
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
      capabilityMeasurements: {
        image: 'unmeasured',
        loadSession: 'unmeasured',
      },
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
