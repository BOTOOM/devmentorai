import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AgentCatalog } from '../../src/acp/catalog/agent-catalog.js';
import { AcpAgentService } from '../../src/acp/catalog/agent-service.js';
import { WorkspaceService } from '../../src/acp/catalog/workspace.js';
import { initDatabase } from '../../src/db/index.js';

describe('ACP conformance probe', () => {
  it('records advertised image and history capabilities distinctly from probe results', async () => {
    const db = initDatabase({ path: ':memory:' });
    const service = new AcpAgentService({
      db,
      workspace: new WorkspaceService({ root: process.cwd() }),
      catalog: new AgentCatalog({ builtIns: [], fetcher: async () => ({ agents: [] }) }),
    });
    service.createProfile({
      name: 'Capability fixture',
      custom: true,
      cmd: path.resolve('node_modules/.bin/tsx'),
      args: [path.resolve('src/acp/fixtures/fixture-agent.ts')],
      env: {
        ACP_FIXTURE_CAPABILITIES: JSON.stringify({
          loadSession: true,
          promptCapabilities: { image: true },
        }),
      },
      defaultCwd: process.cwd(),
      transport: 'stdio',
    });
    const profile = service.listProfiles()[0];
    if (!profile) throw new Error('Probe profile was not created');
    const report = await service.probe(profile.id);
    expect(report.capabilityMeasurements).toEqual({
      image: 'supported',
      loadSession: 'supported',
    });
    expect(report.capabilities).toMatchObject({
      loadSession: true,
      promptCapabilities: { image: true },
    });
    await service.shutdown();
    db.close();
  }, 20_000);

  it('records limitations from an impoverished fixture instead of throwing', async () => {
    const db = initDatabase({ path: ':memory:' });
    const service = new AcpAgentService({
      db,
      workspace: new WorkspaceService({ root: process.cwd() }),
      catalog: new AgentCatalog({ builtIns: [], fetcher: async () => ({ agents: [] }) }),
    });
    service.createProfile({
      name: 'Probe fixture',
      custom: true,
      cmd: path.resolve('node_modules/.bin/tsx'),
      args: [path.resolve('src/acp/fixtures/fixture-agent.ts')],
      env: {
        ACP_FIXTURE_COMMANDS: '[]',
        ACP_FIXTURE_NO_CONFIG: '1',
        ACP_FIXTURE_CAPABILITIES: JSON.stringify({
          promptCapabilities: { image: false, embeddedContext: false },
          loadSession: false,
        }),
      },
      defaultCwd: process.cwd(),
      transport: 'stdio',
    });
    const profile = service.listProfiles()[0];
    if (!profile) throw new Error('Probe profile was not created');
    const report = await service.probe(profile.id);
    expect(report.protocolVersion).toBe(1);
    expect(report.capabilityMeasurements).toEqual({
      image: 'unsupported',
      loadSession: 'unsupported',
    });
    expect(report.checks.image.supported).toBe(false);
    expect(report.checks.history.supported).toBe(false);
    expect(report.checks.prompt.error).toBeUndefined();
    await service.shutdown();
    db.close();
  }, 20_000);
});
