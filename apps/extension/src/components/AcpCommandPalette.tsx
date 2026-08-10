import type { AcpAvailableCommand } from '@devmentorai/shared';
import { useState } from 'react';
import { cn } from '../lib/utils';

type AcpCommandPaletteProps = {
  commands: AcpAvailableCommand[];
  query: string;
  selectedIndex?: number;
  onSelectedIndexChange?: (index: number) => void;
  onSelect: (command: AcpAvailableCommand) => void;
};

export function AcpCommandPalette({
  commands,
  query,
  selectedIndex = 0,
  onSelectedIndexChange,
  onSelect,
}: Readonly<AcpCommandPaletteProps>) {
  const [uncontrolledIndex, setUncontrolledIndex] = useState(selectedIndex);
  const activeIndex = onSelectedIndexChange ? selectedIndex : uncontrolledIndex;
  const setIndex = (index: number) => {
    if (onSelectedIndexChange) onSelectedIndexChange(index);
    else setUncontrolledIndex(index);
  };
  const filtered = commands.filter((command) =>
    command.name.toLowerCase().includes(query.toLowerCase())
  );
  if (filtered.length === 0) return null;
  return (
    <div
      aria-label="Available commands"
      className="rounded border border-slate-300 bg-white p-2 shadow-lg dark:border-slate-600 dark:bg-slate-800"
    >
      {filtered.map((command, index) => (
        <button
          className={cn(
            'block w-full rounded px-2 py-1 text-left text-sm',
            index === activeIndex && 'bg-primary-100 dark:bg-primary-900/40'
          )}
          key={command.name}
          onClick={() => onSelect(command)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setIndex((activeIndex + 1) % filtered.length);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setIndex((activeIndex - 1 + filtered.length) % filtered.length);
            } else if (event.key === 'Enter') {
              event.preventDefault();
              onSelect(filtered[activeIndex] as AcpAvailableCommand);
            }
          }}
          type="button"
        >
          <span className="font-medium">/{command.name}</span>
          <span className="ml-2 text-xs text-slate-500">{command.description}</span>
          {command.input?.hint ? (
            <span className="ml-2 text-xs text-slate-400">({command.input.hint})</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
