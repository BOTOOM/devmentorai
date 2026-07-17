/**
 * Tests for the useAutoResizeTextarea hook.
 *
 * jsdom does not perform layout, so `scrollHeight` is stubbed to simulate
 * content of varying height.
 */
import { cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useAutoResizeTextarea } from '../src/hooks/useAutoResizeTextarea';

afterEach(cleanup);

function stubScrollHeight(el: HTMLTextAreaElement, value: number) {
  Object.defineProperty(el, 'scrollHeight', {
    configurable: true,
    get: () => value,
  });
}

function Harness({ value, scrollHeight }: { value: string; scrollHeight: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Callback ref runs during commit (before layout effects), so the stubbed
  // scrollHeight is in place before the hook measures the element.
  const setRef = (el: HTMLTextAreaElement | null) => {
    ref.current = el;
    if (el) stubScrollHeight(el, scrollHeight);
  };

  useAutoResizeTextarea(ref, { minHeight: 48, maxHeight: 128 });
  return <textarea ref={setRef} data-testid="ta" value={value} readOnly />;
}

describe('useAutoResizeTextarea', () => {
  it('keeps the minimum height for short content', () => {
    const { getByTestId } = render(<Harness value="hi" scrollHeight={30} />);
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    expect(ta.style.height).toBe('48px');
    expect(ta.style.overflowY).toBe('hidden');
  });

  it('grows to fit content between min and max', () => {
    const { getByTestId } = render(<Harness value={'a\nb\nc'} scrollHeight={90} />);
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    expect(ta.style.height).toBe('90px');
    expect(ta.style.overflowY).toBe('hidden');
  });

  it('caps at the maximum height and enables internal scrolling', () => {
    const { getByTestId } = render(<Harness value={'lots of text'} scrollHeight={400} />);
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    expect(ta.style.height).toBe('128px');
    expect(ta.style.overflowY).toBe('auto');
  });

  it('recalculates when the value changes', () => {
    const { getByTestId, rerender } = render(<Harness value="hi" scrollHeight={30} />);
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    expect(ta.style.height).toBe('48px');

    rerender(<Harness value={'a\nb\nc\nd'} scrollHeight={110} />);
    expect(ta.style.height).toBe('110px');
  });
});
