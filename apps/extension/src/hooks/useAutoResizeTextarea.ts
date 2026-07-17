/**
 * Hook that auto-grows a textarea to fit its content up to a maximum height,
 * enabling internal scrolling once the maximum is reached.
 *
 * The height is recomputed on every render (so it follows the controlled
 * value: typing, pasting, clearing, external inserts) and whenever the
 * viewport width changes (wrapping affects height).
 */
import { useCallback, useLayoutEffect } from 'react';

interface AutoResizeOptions {
  /** Minimum height in pixels (collapsed / empty state). */
  minHeight?: number;
  /** Maximum height in pixels before internal scrolling kicks in. */
  maxHeight?: number;
}

const DEFAULT_MIN_HEIGHT = 48;
const DEFAULT_MAX_HEIGHT = 128;

export function useAutoResizeTextarea(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  options?: AutoResizeOptions
): void {
  const minHeight = options?.minHeight ?? DEFAULT_MIN_HEIGHT;
  const maxHeight = options?.maxHeight ?? DEFAULT_MAX_HEIGHT;

  const resize = useCallback(() => {
    const textarea = ref.current;
    if (!textarea) return;

    // Reset height so scrollHeight reflects the content, not the previous height.
    textarea.style.height = 'auto';
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [ref, minHeight, maxHeight]);

  // Recompute after every render (follows the controlled value).
  useLayoutEffect(resize);

  // Recompute when the viewport or the element itself is resized.
  useLayoutEffect(() => {
    const textarea = ref.current;
    if (!textarea) return;

    window.addEventListener('resize', resize);

    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(resize);
      observer.observe(textarea);
    }

    return () => {
      window.removeEventListener('resize', resize);
      observer?.disconnect();
    };
  }, [ref, resize]);
}
