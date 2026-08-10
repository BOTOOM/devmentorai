import type { AcpAvailableCommand } from '@devmentorai/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AcpCommandPalette } from '../src/components/AcpCommandPalette';
import { AcpSurfaces } from '../src/components/AcpSurfaces';
import { PermissionCard } from '../src/components/PermissionCard';
import { initialAcpChatState, reduceAcpEvent } from '../src/services/acp-reducer';

afterEach(cleanup);

describe('ACP surfaces', () => {
  it('filters commands, shows hint and inserts the selected command', () => {
    const onSelect = vi.fn();
    const commands: AcpAvailableCommand[] = [
      { name: 'usage', description: 'Show usage', input: { hint: 'detail' } },
      { name: 'plan', description: 'Show plan' },
    ];
    render(<AcpCommandPalette commands={commands} onSelect={onSelect} query="usa" />);
    expect(screen.getByText('Show usage')).toBeTruthy();
    expect(screen.getByText('(detail)')).toBeTruthy();
    expect(screen.queryByText('Show plan')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /usage/ }));
    expect(onSelect).toHaveBeenCalledWith(commands[0]);
    const navigation = vi.fn();
    cleanup();
    render(<AcpCommandPalette commands={commands} onSelect={navigation} query="" />);
    const firstButton = screen.getByRole('button', { name: /usage/ }) as HTMLButtonElement;
    firstButton.focus();
    fireEvent.keyDown(firstButton, { key: 'ArrowDown' });
    fireEvent.keyDown(firstButton, { key: 'Enter' });
    expect(navigation).toHaveBeenCalledWith(commands[1]);
  });

  it('renders one tool card through its lifecycle and displays diffs and plans', () => {
    let state = reduceAcpEvent(
      initialAcpChatState,
      {
        type: 'tool_call',
        toolCallId: 'tool-1',
        title: 'Edit file',
        kind: 'edit',
        status: 'pending',
        content: [{ type: 'diff', path: 'src/a.ts', oldText: 'old', newText: 'new' }],
        mode: 'replace',
      },
      'session'
    );
    state = reduceAcpEvent(
      state,
      { type: 'tool_call', toolCallId: 'tool-1', status: 'in_progress', mode: 'replace' },
      'session'
    );
    state = reduceAcpEvent(
      state,
      { type: 'tool_call', toolCallId: 'tool-1', status: 'completed', mode: 'replace' },
      'session'
    );
    state = reduceAcpEvent(
      state,
      { type: 'plan', entries: [{ content: 'Run tests', priority: 'high', status: 'pending' }] },
      'session'
    );
    render(<AcpSurfaces state={state} />);
    expect(screen.getAllByText('Edit file')).toHaveLength(1);
    expect(screen.getByText('src/a.ts')).toBeTruthy();
    expect(screen.getByText('old')).toBeTruthy();
    expect(screen.getByText('Run tests')).toBeTruthy();
  });

  it('exposes permission choices and revocation', () => {
    const onRespond = vi.fn();
    const onRevoke = vi.fn();
    render(
      <PermissionCard
        onDismiss={vi.fn()}
        onRespond={onRespond}
        onRevoke={onRevoke}
        request={{
          sessionId: 'session',
          toolCall: { toolCallId: 'tool', title: 'Run command', status: 'pending' },
          options: [{ optionId: 'always', kind: 'allow_always', name: 'Always allow' }],
        }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Always allow' }));
    fireEvent.click(screen.getByRole('button', { name: 'Forget remembered choice' }));
    expect(onRespond).toHaveBeenCalledWith('always');
    expect(onRevoke).toHaveBeenCalledTimes(1);
  });
});
