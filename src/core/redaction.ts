/**
 * Sensitive information redaction
 */

import { sha256 } from './utils.js';

export interface RedactedContent {
  redacted: true;
  hash: string;
  originalLength: number;
}

/**
 * Patterns that indicate sensitive content
 */
const SENSITIVE_PATTERNS = [
  // API keys and tokens
  /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi,
  /secret\s*[:=]\s*['"][^'"]+['"]/gi,
  /token\s*[:=]\s*['"][^'"]+['"]/gi,
  /password\s*[:=]\s*['"][^'"]+['"]/gi,
  /bearer\s+[A-Za-z0-9._-]+/gi,

  // AWS credentials
  /AKIA[A-Z0-9]{16}/g,
  /aws[_-]?secret[_-]?access[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi,

  // Private keys
  /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g,
  /-----BEGIN\s+OPENSSH\s+PRIVATE\s+KEY-----/g,

  // Connection strings
  /mongodb(\+srv)?:\/\/[^\s]+/gi,
  /postgres(ql)?:\/\/[^\s]+/gi,
  /mysql:\/\/[^\s]+/gi,
  /redis:\/\/[^\s]+/gi,

  // Email patterns (may indicate hardcoded contacts)
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

  // IP addresses
  /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,

  // URLs with credentials
  /https?:\/\/[^:]+:[^@]+@[^\s]+/gi,
];

/**
 * Redact a code snippet for evidence storage
 */
export function redactSnippet(snippet: string): RedactedContent {
  return {
    redacted: true,
    hash: `sha256:${sha256(snippet)}`,
    originalLength: snippet.length,
  };
}

/**
 * Check if content contains sensitive patterns
 */
export function containsSensitiveContent(content: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(content);
  });
}

/**
 * Hash content for verification
 */
export function hashContent(content: string): string {
  return `sha256:${sha256(content)}`;
}

/**
 * Redact sensitive portions of a string while preserving structure
 * Returns the redacted string and positions of redactions
 */
export function partialRedact(content: string): {
  redacted: string;
  redactionCount: number;
} {
  let result = content;
  let count = 0;

  for (const pattern of SENSITIVE_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = result.match(pattern);
    if (matches) {
      for (const match of matches) {
        result = result.replace(match, `[REDACTED:${sha256(match).slice(0, 8)}]`);
        count++;
      }
    }
  }

  return { redacted: result, redactionCount: count };
}
