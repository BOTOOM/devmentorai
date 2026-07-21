/**
 * Tests for MarkdownContent rendering and XSS safety.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MarkdownContent } from '../src/components/MarkdownContent';

afterEach(cleanup);

describe('MarkdownContent', () => {
  it('renders headings, bold and italic', () => {
    const { container } = render(
      <MarkdownContent content={'# Title\n\n**bold** and *italic*'} variant="assistant" />
    );

    expect(container.querySelector('h1')?.textContent).toBe('Title');
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('em')?.textContent).toBe('italic');
  });

  it('renders links opening in a new tab with a hardened rel', () => {
    render(<MarkdownContent content={'[DevMentor](https://example.com)'} variant="assistant" />);

    const link = screen.getByRole('link', { name: 'DevMentor' });
    expect(link.getAttribute('href')).toBe('https://example.com');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.getAttribute('rel')).toContain('noreferrer');
  });

  it('renders unordered and ordered lists', () => {
    const { container } = render(
      <MarkdownContent content={'- a\n- b\n\n1. one\n2. two'} variant="assistant" />
    );

    expect(container.querySelectorAll('ul li')).toHaveLength(2);
    expect(container.querySelectorAll('ol li')).toHaveLength(2);
  });

  it('renders blockquotes', () => {
    const { container } = render(<MarkdownContent content={'> quoted text'} variant="assistant" />);
    expect(container.querySelector('blockquote')?.textContent).toContain('quoted text');
  });

  it('renders inline code and fenced code blocks', () => {
    const { container } = render(
      <MarkdownContent
        content={'inline `code` here\n\n```ts\nconst x = 1;\n```'}
        variant="assistant"
      />
    );

    const pre = container.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre?.textContent).toContain('const x = 1;');

    // Inline code is a <code> not wrapped in <pre>.
    const inlineCodes = Array.from(container.querySelectorAll('code')).filter(
      (el) => !el.closest('pre')
    );
    expect(inlineCodes.some((el) => el.textContent === 'code')).toBe(true);
  });

  it('renders GFM tables', () => {
    const md = '| A | B |\n| - | - |\n| 1 | 2 |';
    const { container } = render(<MarkdownContent content={md} variant="assistant" />);

    expect(container.querySelector('table')).not.toBeNull();
    expect(container.querySelectorAll('th')).toHaveLength(2);
    expect(container.querySelectorAll('tbody td')).toHaveLength(2);
  });

  it('preserves single line breaks (remark-breaks)', () => {
    const { container } = render(
      <MarkdownContent content={'line one\nline two'} variant="assistant" />
    );
    expect(container.querySelector('br')).not.toBeNull();
  });

  it('renders plain text unchanged', () => {
    render(<MarkdownContent content={'just plain text'} variant="user" />);
    expect(screen.getByText('just plain text')).toBeTruthy();
  });

  describe('XSS safety', () => {
    it('does not execute or inject raw <script> HTML', () => {
      const { container } = render(
        <MarkdownContent content={'<script>alert(1)</script>'} variant="assistant" />
      );
      expect(container.querySelector('script')).toBeNull();
    });

    it('does not inject raw HTML elements with event handlers', () => {
      const { container } = render(
        <MarkdownContent content={'<img src=x onerror="alert(1)">'} variant="assistant" />
      );
      expect(container.querySelector('img')).toBeNull();
    });

    it('strips javascript: URLs from links', () => {
      const { container } = render(
        <MarkdownContent content={'[click](javascript:alert(1))'} variant="assistant" />
      );
      const link = container.querySelector('a');
      expect(link?.getAttribute('href') ?? '').not.toContain('javascript:');
    });
  });
});
