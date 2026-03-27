/**
 * Discord-style Markdown renderer using react-markdown for safety.
 * Supports: **bold**, *italic*, ~~strike~~, `code`, ```code blocks```,
 * ||spoilers||, > quotes, links, @mentions, inline images
 */
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface Props {
  content: string;
}

export function Markdown({ content }: Props) {
  const processed = preprocess(content);

  return (
    <span className="md-content">
      <ReactMarkdown
        components={{
          img: ({ src, alt }) => {
            if (!src) return null;
            return (
              <a href={src} target="_blank" rel="noopener noreferrer">
                <img src={src} alt={alt || ''} className="md-inline-img" loading="lazy" />
              </a>
            );
          },
          pre: ({ children }) => (
            <pre className="md-codeblock">{children}</pre>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.startsWith('language-');
            if (isBlock) return <code className="md-code-lang">{children}</code>;
            return <code className="md-code">{children}</code>;
          },
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="md-link">
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="md-quote">{children}</blockquote>
          ),
          p: ({ children }) => <SpoilerAwareP>{children}</SpoilerAwareP>,
          strong: ({ children }) => {
            // Check if this is a @mention (preprocessed to **@user**)
            const text = String(children);
            if (text.startsWith('@')) {
              return (
                <span className="md-mention" data-mention={text.slice(1)} style={{
                  background: 'rgba(88,101,242,0.3)', color: '#dee0fc',
                  padding: '0 3px', borderRadius: 3, fontWeight: 500, cursor: 'pointer',
                }}>
                  {text}
                </span>
              );
            }
            return <strong>{children}</strong>;
          },
        }}
      >
        {processed}
      </ReactMarkdown>
    </span>
  );
}

/** Renders paragraph children with spoiler support */
function SpoilerAwareP({ children }: { children: React.ReactNode }) {
  // Check if content contains spoilers
  if (typeof children === 'string' && children.includes('||')) {
    return <span className="md-p">{renderSpoilers(children)}</span>;
  }
  return <span className="md-p">{children}</span>;
}

function renderSpoilers(text: string): React.ReactNode[] {
  const parts = text.split(/\|\|/);
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      // Inside spoiler
      return <SpoilerText key={i} text={part} />;
    }
    return <span key={i}>{part}</span>;
  });
}

function SpoilerText({ text }: { text: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      onClick={() => setRevealed(!revealed)}
      className={`md-spoiler ${revealed ? 'revealed' : ''}`}
      style={{
        background: revealed ? 'rgba(255,255,255,0.06)' : '#1e1f22',
        color: revealed ? 'inherit' : 'transparent',
        padding: '0 4px', borderRadius: 3, cursor: 'pointer',
        transition: 'all 0.15s ease',
        userSelect: revealed ? 'auto' : 'none',
      }}
    >
      {text}
    </span>
  );
}

function preprocess(text: string): string {
  let result = text;

  // Convert @mentions to bold (rendered as styled span via strong override)
  result = result.replace(/@(\w+)/g, '**@$1**');

  // Auto-detect image URLs and convert to markdown image syntax
  result = result.replace(
    /(?<!\[)(?<!\()https?:\/\/[^\s<)]+\.(png|jpg|jpeg|gif|webp)(\?[^\s<)]*)?/gi,
    '\n![]($&)\n'
  );

  return result;
}
