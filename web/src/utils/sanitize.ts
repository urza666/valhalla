/**
 * HTML sanitization wrapper using DOMPurify.
 * All user-generated content MUST pass through this before rendering.
 */
import DOMPurify from 'dompurify';

/** Sanitize HTML — strips all dangerous tags/attributes, keeps safe formatting */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'a', 'code', 'pre', 'br', 'p', 'span',
      'ul', 'ol', 'li', 'blockquote', 'del', 's', 'sub', 'sup',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'img',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'src', 'alt', 'width', 'height'],
    ALLOW_DATA_ATTR: false,
  });
}

/** Sanitize to plain text — strip ALL HTML */
export function sanitizeText(dirty: string): string {
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

/** Escape HTML entities for safe embedding in HTML context */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (c) => map[c]);
}
