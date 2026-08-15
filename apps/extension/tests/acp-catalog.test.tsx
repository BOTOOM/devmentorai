import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AcpCatalogView } from '../src/components/AcpCatalogView';
import { AcpProfileEditor } from '../src/components/AcpProfileEditor';

afterEach(cleanup);

describe('ACP catalog and profiles', () => {
  it('lists and enables an unknown registry entry without agent-specific code', async () => {
    const client = {
      listAgents: vi.fn().mockResolvedValue([
        {
          id: 'future-agent',
          name: 'Future Agent',
          source: 'registry',
          installState: 'not_installed',
          authState: 'unknown',
          authMethods: [],
          platformAvailability: { available: true, key: 'linux-x86_64' },
        },
      ]),
      listProfiles: vi.fn().mockResolvedValue([]),
      enableAgent: vi.fn().mockImplementation(async () => {
        client.listAgents.mockResolvedValue([
          {
            id: 'future-agent',
            name: 'Future Agent',
            source: 'registry',
            installState: 'lazy',
            authState: 'unknown',
            authMethods: [],
            enabled: true,
            platformAvailability: { available: true, key: 'linux-x86_64' },
          },
        ]);
        return { entry: { id: 'future-agent' }, profile: { id: 'profile' } };
      }),
    };
    render(<AcpCatalogView client={client as never} />);
    expect(await screen.findByText('Future Agent')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Enable' }));
    await waitFor(() => expect(client.enableAgent).toHaveBeenCalledWith('future-agent'));
    expect(await screen.findByRole('button', { name: 'Enabled' })).toBeTruthy();
  });

  it('submits a custom profile without exposing credential values', async () => {
    const client = {
      createProfile: vi.fn().mockResolvedValue({
        id: 'profile',
        name: 'Custom',
        args: [],
        env: {},
        defaultCwd: '/workspace',
        transport: 'stdio',
      }),
    };
    render(<AcpProfileEditor client={client as never} />);
    fireEvent.change(screen.getByLabelText('Profile name'), { target: { value: 'Custom' } });
    fireEvent.change(screen.getByLabelText('Command'), { target: { value: 'future-agent' } });
    fireEvent.change(screen.getByLabelText('Default cwd'), { target: { value: '/workspace' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
    await waitFor(() => expect(client.createProfile).toHaveBeenCalled());
    expect(client.createProfile.mock.calls[0]?.[0]).toMatchObject({
      cmd: 'future-agent',
      defaultCwd: '/workspace',
      env: {},
    });
  });

  it('selects a profile for the ACP session launcher', async () => {
    const profile = {
      id: 'profile',
      name: 'Future Agent',
      args: [],
      env: {},
      defaultCwd: '/workspace',
      transport: 'stdio' as const,
    };
    const client = {
      listAgents: vi.fn().mockResolvedValue([]),
      listProfiles: vi.fn().mockResolvedValue([profile]),
    };
    const onProfileSelected = vi.fn();
    render(<AcpCatalogView client={client as never} onProfileSelected={onProfileSelected} />);
    fireEvent.change(await screen.findByLabelText('ACP profile'), {
      target: { value: 'profile' },
    });
    expect(onProfileSelected).toHaveBeenCalledWith(profile);
  });
});
