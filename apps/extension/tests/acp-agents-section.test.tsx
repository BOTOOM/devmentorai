import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AcpAgentsSection } from '../src/components/AcpAgentsSection';

afterEach(cleanup);

type Entry = {
  id: string;
  name: string;
  source: string;
  installState: string;
  authState: string;
  authMethods: Array<{ id: string; description: string }>;
  enabled?: boolean;
  default?: boolean;
  profileId?: string;
  auth?: { envVars: string[]; tokenUrl?: string; localLogin?: string };
  platformAvailability: { available: boolean; key: string; reason?: string };
};

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'github-copilot-cli',
    name: 'GitHub Copilot CLI',
    source: 'registry',
    installState: 'lazy',
    authState: 'unknown',
    authMethods: [],
    platformAvailability: { available: true, key: 'linux-x86_64' },
    ...overrides,
  };
}

describe('AcpAgentsSection', () => {
  it('enables an agent with a single click and reloads its state', async () => {
    const client = {
      listAgents: vi.fn().mockResolvedValue([entry()]),
      listProfiles: vi.fn().mockResolvedValue([]),
      enableAgent: vi.fn().mockImplementation(async () => {
        client.listAgents.mockResolvedValue([entry({ enabled: true, default: true })]);
        return { entry: entry({ enabled: true }), profile: { id: 'profile' } };
      }),
    };
    render(<AcpAgentsSection client={client as never} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Enable' }));
    await waitFor(() => expect(client.enableAgent).toHaveBeenCalledWith('github-copilot-cli'));
    expect(await screen.findByRole('button', { name: 'Disable' })).toBeTruthy();
    expect(screen.getByText('Enabled')).toBeTruthy();
  });

  it('marks an enabled agent as the default', async () => {
    const client = {
      listAgents: vi.fn().mockResolvedValue([entry({ enabled: true })]),
      listProfiles: vi.fn().mockResolvedValue([]),
      setDefaultAgent: vi.fn().mockResolvedValue(undefined),
    };
    render(<AcpAgentsSection client={client as never} />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Make GitHub Copilot CLI the default' })
    );
    await waitFor(() => expect(client.setDefaultAgent).toHaveBeenCalledWith('github-copilot-cli'));
  });

  it('sends a pasted token to the backend for the declared environment variable', async () => {
    const client = {
      listAgents: vi.fn().mockResolvedValue([
        entry({
          enabled: true,
          authState: 'required',
          profileId: 'profile',
          auth: { envVars: ['COPILOT_GITHUB_TOKEN', 'GH_TOKEN'] },
        }),
      ]),
      listProfiles: vi.fn().mockResolvedValue([]),
      setAgentToken: vi.fn().mockResolvedValue({ id: 'profile' }),
    };
    render(<AcpAgentsSection client={client as never} />);
    expect(await screen.findByText('Auth required')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'More options for GitHub Copilot CLI' }));
    fireEvent.change(await screen.findByLabelText('Token for COPILOT_GITHUB_TOKEN'), {
      target: { value: 'ghp_example' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save token' }));
    await waitFor(() =>
      expect(client.setAgentToken).toHaveBeenCalledWith(
        'github-copilot-cli',
        'ghp_example',
        'COPILOT_GITHUB_TOKEN'
      )
    );
  });

  it('surfaces a load failure with a retry instead of an empty list', async () => {
    const client = {
      listAgents: vi.fn().mockRejectedValue(new Error('ACP WebSocket closed')),
      listProfiles: vi.fn().mockResolvedValue([]),
    };
    render(<AcpAgentsSection client={client as never} />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('ACP WebSocket closed')).toBeTruthy();
    client.listAgents.mockResolvedValue([entry()]);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('GitHub Copilot CLI')).toBeTruthy();
  });

  it('does not offer Enable for an agent unavailable on this platform', async () => {
    const client = {
      listAgents: vi.fn().mockResolvedValue([
        entry({
          platformAvailability: {
            available: false,
            key: 'linux-x86_64',
            reason: 'No linux-x86_64 build',
          },
        }),
      ]),
      listProfiles: vi.fn().mockResolvedValue([]),
    };
    render(<AcpAgentsSection client={client as never} />);
    expect(await screen.findByText('Unavailable')).toBeTruthy();
    expect(screen.getByText('No linux-x86_64 build')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Enable' })).toBeNull();
  });
});
