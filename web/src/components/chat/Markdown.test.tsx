import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Markdown } from './Markdown';

describe('Markdown Component', () => {
  const renderMd = (content: string) => {
    const { container } = render(<Markdown content={content} />);
    return container.innerHTML;
  };

  it('renders plain text', () => {
    const html = renderMd('Hello world');
    expect(html).toContain('Hello world');
  });

  it('renders bold', () => {
    const html = renderMd('**bold text**');
    expect(html).toContain('<strong>bold text</strong>');
  });

  it('renders italic with asterisks', () => {
    const html = renderMd('*italic text*');
    expect(html).toContain('<em>italic text</em>');
  });

  it('renders underline before italic underscore', () => {
    const html = renderMd('__underlined__');
    expect(html).toContain('<u>underlined</u>');
    expect(html).not.toContain('<em><em>');
  });

  it('renders strikethrough', () => {
    const html = renderMd('~~deleted~~');
    expect(html).toContain('<del>deleted</del>');
  });

  it('renders inline code', () => {
    const html = renderMd('use `const x`');
    expect(html).toContain('<code class="md-code">const x</code>');
  });

  it('renders code blocks', () => {
    const html = renderMd('```js\nconsole.log("hi")\n```');
    expect(html).toContain('<pre class="md-codeblock"');
    expect(html).toContain('console.log');
  });

  it('renders spoilers', () => {
    const html = renderMd('||secret||');
    expect(html).toContain('class="md-spoiler"');
    expect(html).toContain('secret');
  });

  it('renders blockquotes', () => {
    const html = renderMd('> quoted text');
    expect(html).toContain('<blockquote');
    expect(html).toContain('quoted text');
  });

  it('renders links', () => {
    const html = renderMd('visit https://example.com today');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
  });

  it('renders mentions', () => {
    const html = renderMd('hello @testuser');
    expect(html).toContain('class="md-mention"');
    expect(html).toContain('@testuser');
  });

  it('escapes HTML', () => {
    const html = renderMd('<script>alert("xss")</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('renders images from URLs', () => {
    const html = renderMd('https://example.com/image.png');
    expect(html).toContain('<img src=');
    expect(html).toContain('image.png');
  });

  it('renders newlines as br', () => {
    const html = renderMd('line1\nline2');
    expect(html).toContain('<br/>');
  });
});
