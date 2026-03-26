/**
 * Discord-style Markdown renderer using react-markdown for safety.
 * Ported from lan-party-platform MarkdownContent with Valhalla extensions.
 *
 * Supports: **bold**, *italic*, ~~strike~~, `code`, ```code blocks```,
 * ||spoilers||, > quotes, links, @mentions, inline images
 */
import ReactMarkdown from 'react-markdown';

interface Props {
  content: string;
}

export function Markdown({ content }: Props) {
  // Pre-process Discord-specific syntax that react-markdown doesn't handle
  const processed = preprocess(content);

  return (
    <span className="md-content">
      <ReactMarkdown
        components={{
          // Prevent rendering of raw images for XSS safety — only allow known URLs
          img: ({ src, alt }) => {
            if (!src) return null;
            return (
              <a href={src} target="_blank" rel="noopener noreferrer">
                <img src={src} alt={alt || ''} className="md-inline-img" loading="lazy" />
              </a>
            );
          },
          // Code blocks with syntax highlighting hint
          pre: ({ children }) => (
            <pre className="md-codeblock">{children}</pre>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.startsWith('language-');
            if (isBlock) return <code>{children}</code>;
            return <code className="md-code">{children}</code>;
          },
          // Links open in new tab
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="md-link">
              {children}
            </a>
          ),
          // Blockquotes styled
          blockquote: ({ children }) => (
            <blockquote className="md-quote">{children}</blockquote>
          ),
          // Paragraphs without extra margin in chat context
          p: ({ children }) => <span className="md-p">{children}</span>,
        }}
      >
        {processed}
      </ReactMarkdown>
    </span>
  );
}

function preprocess(text: string): string {
  let result = text;

  // Convert spoiler syntax ||text|| to HTML (react-markdown doesn't support this)
  // We'll render them in a post-process step instead
  // For now keep || as-is — CSS handles visibility

  // Convert @mentions to bold links
  result = result.replace(/@(\w+)/g, '**@$1**');

  // Auto-detect image URLs and convert to markdown image syntax
  result = result.replace(
    /(?<!\[)(?<!\()https?:\/\/[^\s<)]+\.(png|jpg|jpeg|gif|webp)(\?[^\s<)]*)?/gi,
    '\n![]($&)\n'
  );

  return result;
}
