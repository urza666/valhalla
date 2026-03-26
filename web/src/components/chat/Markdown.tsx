import { useMemo } from 'react';

interface Props {
  content: string;
}

// Lightweight Discord-style markdown renderer.
// Supports: **bold**, *italic*, __underline__, ~~strikethrough~~,
// `inline code`, ```code blocks```, ||spoilers||, > quotes, links, lists
export function Markdown({ content }: Props) {
  const rendered = useMemo(() => parseMarkdown(content), [content]);
  return <span dangerouslySetInnerHTML={{ __html: rendered }} />;
}

function parseMarkdown(text: string): string {
  // Escape HTML first
  let html = escapeHtml(text);

  // Code blocks (```lang\ncode```) — must be before inline transforms
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, lang, code) => {
    const langClass = lang ? ` data-lang="${lang}"` : '';
    return `<pre class="md-codeblock"${langClass}><code>${code.trim()}</code></pre>`;
  });

  // Inline code (`code`) — must be before other inline transforms
  html = html.replace(/`([^`\n]+)`/g, '<code class="md-code">$1</code>');

  // Bold + italic (***text***)
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');

  // Bold (**text**)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic (*text* or _text_)
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>');

  // Underline (__text__)
  html = html.replace(/__(.+?)__/g, '<u>$1</u>');

  // Strikethrough (~~text~~)
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Spoiler (||text||)
  html = html.replace(/\|\|(.+?)\|\|/g, '<span class="md-spoiler" onclick="this.classList.toggle(\'revealed\')">$1</span>');

  // Block quotes (> text)
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="md-quote">$1</blockquote>');

  // Image URLs (render as inline images)
  html = html.replace(
    /(?<!")https?:\/\/[^\s<]+\.(png|jpg|jpeg|gif|webp)(\?[^\s<]*)?/gi,
    '<br/><a href="$&" target="_blank"><img src="$&" class="md-inline-img" loading="lazy" alt="" /></a>'
  );

  // Links (auto-detect remaining URLs)
  html = html.replace(
    /(?<!")(?<!src=")https?:\/\/[^\s<]+/g,
    '<a href="$&" target="_blank" rel="noopener noreferrer" class="md-link">$&</a>'
  );

  // Mentions (@username) — styled but not functional yet
  html = html.replace(/@(\w+)/g, '<span class="md-mention">@$1</span>');

  // Newlines
  html = html.replace(/\n/g, '<br/>');

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
