import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AcpCatalogView } from '../src/components/AcpCatalogView';
import { AcpProfileEditor } from '../src/components/AcpProfileEditor';

afterEach(cleanup);

describe('ACP catalog and profiles', () => {
  it('lists and installs an unknown registry entry without agent-specific code', async () => {
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
      installAgent: vi.fn().mockResolvedValue({
        id: 'future-agent',
        name: 'Future Agent',
        source: 'registry',
        installState: 'installed',
        authState: 'unknown',
        authMethods: [],
        platformAvailability: { available: true, key: 'linux-x86_64' },
      }),
    };
    render(<AcpCatalogView client={client as never} />);
    expect(await screen.findByText('Future Agent')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Install' }));
    await waitFor(() => expect(client.installAgent).toHaveBeenCalledWith('future-agent'));
    expect(await screen.findByRole('button', { name: 'Installed' })).toBeTruthy();
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
});
