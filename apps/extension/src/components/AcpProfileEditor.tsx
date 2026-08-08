import { useState } from 'react';
import type { AcpClient, AcpProfile } from '../services/acp-client';

type AcpProfileEditorProps = {
  client: AcpClient;
  profile?: AcpProfile;
  onSaved?: (profile: AcpProfile) => void;
};

export function AcpProfileEditor({ client, profile, onSaved }: Readonly<AcpProfileEditorProps>) {
  const [name, setName] = useState(profile?.name ?? '');
  const [agentId, setAgentId] = useState(profile?.agentId ?? '');
  const [cmd, setCmd] = useState(profile?.cmd ?? '');
  const [args, setArgs] = useState(profile?.args.join(' ') ?? '');
  const [cwd, setCwd] = useState(profile?.defaultCwd ?? '');
  const [transport, setTransport] = useState<'stdio' | 'tcp'>(profile?.transport ?? 'stdio');
  const [host, setHost] = useState(profile?.host ?? '127.0.0.1');
  const [port, setPort] = useState(profile?.port?.toString() ?? '');
  const save = async () => {
    const input = {
      name,
      ...(agentId ? { agentId } : { custom: true, cmd }),
      args: args ? args.split(/\s+/) : [],
      env: {},
      defaultCwd: cwd,
      transport,
      ...(transport === 'tcp' ? { host, port: Number(port) } : {}),
    };
    const saved = profile
      ? await client.updateProfile(profile.id, input)
      : await client.createProfile(input);
    onSaved?.(saved);
  };
  return (
    <form
      aria-label="ACP profile editor"
      className="space-y-2 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <input
        aria-label="Profile name"
        onChange={(event) => setName(event.target.value)}
        value={name}
      />
      <input
        aria-label="Agent id"
        onChange={(event) => setAgentId(event.target.value)}
        value={agentId}
      />
      {!agentId ? (
        <input aria-label="Command" onChange={(event) => setCmd(event.target.value)} value={cmd} />
      ) : null}
      <input
        aria-label="Arguments"
        onChange={(event) => setArgs(event.target.value)}
        value={args}
      />
      <input
        aria-label="Default cwd"
        onChange={(event) => setCwd(event.target.value)}
        value={cwd}
      />
      <select
        aria-label="Transport"
        onChange={(event) => setTransport(event.target.value as 'stdio' | 'tcp')}
        value={transport}
      >
        <option value="stdio">stdio</option>
        <option value="tcp">tcp</option>
      </select>
      {transport === 'tcp' ? (
        <>
          <input
            aria-label="TCP host"
            onChange={(event) => setHost(event.target.value)}
            value={host}
          />
          <input
            aria-label="TCP port"
            onChange={(event) => setPort(event.target.value)}
            value={port}
          />
        </>
      ) : null}
      <button type="submit">Save profile</button>
    </form>
  );
}
