/**
 * Secret Redaction & Truncation Utility for PDL Diagnostics (Gate 3D.3).
 *
 * Enforces strict secret scrubbing and bounded size limits before diagnostic
 * strings can be stored, inspected, or fed into downstream correction prompts.
 */

export const MAX_MESSAGE_LENGTH = 4000;
export const MAX_TEST_OUTPUT_LENGTH = 8000;
export const MAX_DIFF_LENGTH = 12000;

// High-entropy token patterns
const BEARER_TOKEN_REGEX = /Bearer\s+[A-Za-z0-9._~+/-]{6,}/gi;
const BASIC_AUTH_REGEX = /Basic\s+[A-Za-z0-9+/=]{8,}/gi;

// Well-known vendor token prefixes (GitHub, OpenAI, Anthropic, AWS, Slack, Stripe)
const GITHUB_TOKEN_REGEX = /\b(gh[pousr]_[A-Za-z0-9]{36,}|gh[a-z]_[A-Za-z0-9]{36,})\b/g;
const OPENAI_KEY_REGEX = /\b(sk-(?:live|test|proj)?[A-Za-z0-9_-]{20,})\b/g;
const ANTHROPIC_KEY_REGEX = /\b(sk-ant-[A-Za-z0-9_-]{20,})\b/g;
const SLACK_TOKEN_REGEX = /\b(xox[baprs]-[A-Za-z0-9-]{10,})\b/g;
const AWS_KEY_REGEX = /\b(AKIA[0-9A-Z]{16})\b/g;
const STRIPE_KEY_REGEX = /\b([rs]k_(?:live|test)_[0-9a-zA-Z]{24,})\b/g;

// Database connection strings: postgres://user:password@host:port/db
const CONNECTION_STRING_REGEX = /(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/([^:]+):([^@\s]+)@/gi;

// Generic key=value assignments (API_KEY=..., SECRET=..., PASSWORD=...), ignoring already-redacted markers
const GENERIC_KEY_VALUE_SECRET = /(?:api[_-]?key|token|secret|password|passwd|auth[_-]?token|access[_-]?key)[ \t]*[:=][ \t]*['"]?(?!\[REDACTED)([^\s'"&;]{6,})['"]?/gi;

// Authorization header for non-Bearer/Basic tokens
const AUTH_HEADER_REGEX = /(?:authorization|proxy-authorization):[ \t]+(?!(?:bearer|basic)\b)[^\r\n]+/gi;

/**
 * Deterministically sanitizes raw text by redacting all detected secrets,
 * authorization headers, database connection credentials, and known environment keys.
 */
export function redactSecrets(text: string | null | undefined): string {
  if (!text) return '';
  let result = String(text);

  // 1. Redact values corresponding to process.env sensitive keys
  for (const [key, secret] of Object.entries(process.env)) {
    if (
      secret &&
      /(api[_-]?key|token|password|secret|credential|private[_-]?key|auth)/i.test(key) &&
      secret.length >= 4
    ) {
      result = result.split(secret).join('[REDACTED]');
    }
  }

  // 2. Redact vendor-specific token shapes
  result = result.replace(GITHUB_TOKEN_REGEX, '[REDACTED_GITHUB_TOKEN]');
  result = result.replace(OPENAI_KEY_REGEX, '[REDACTED_OPENAI_KEY]');
  result = result.replace(ANTHROPIC_KEY_REGEX, '[REDACTED_ANTHROPIC_KEY]');
  result = result.replace(SLACK_TOKEN_REGEX, '[REDACTED_SLACK_TOKEN]');
  result = result.replace(AWS_KEY_REGEX, '[REDACTED_AWS_KEY]');
  result = result.replace(STRIPE_KEY_REGEX, '[REDACTED_STRIPE_KEY]');

  // 3. Redact Bearer and Basic tokens
  result = result.replace(BEARER_TOKEN_REGEX, 'Bearer [REDACTED]');
  result = result.replace(BASIC_AUTH_REGEX, 'Basic [REDACTED]');

  // 4. Redact other authorization headers
  result = result.replace(AUTH_HEADER_REGEX, 'authorization: [REDACTED]');

  // 5. Redact database passwords in connection strings
  result = result.replace(CONNECTION_STRING_REGEX, '$1://$2:[REDACTED]@');

  // 6. Redact generic key=value / key: value secret patterns
  result = result.replace(GENERIC_KEY_VALUE_SECRET, (match) => {
    const separatorIdx = match.search(/[:=]/);
    if (separatorIdx === -1) return '[REDACTED]';
    const prefix = match.slice(0, separatorIdx + 1);
    return `${prefix} [REDACTED]`;
  });

  return result;
}

/**
 * Truncates text to a maximum length while appending a deterministic indicator.
 */
export function truncateContent(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const suffix = `\n... [TRUNCATED ${text.length - maxLength} CHARS]`;
  const sliceEnd = Math.max(0, maxLength - suffix.length);
  return text.slice(0, sliceEnd) + suffix;
}

/**
 * Sanitizes and truncates error message.
 */
export function sanitizeMessage(message: string | null | undefined, maxLen = MAX_MESSAGE_LENGTH): string {
  if (!message) return '';
  return truncateContent(redactSecrets(message), maxLen);
}

/**
 * Sanitizes and truncates test/execution output.
 */
export function sanitizeTestOutput(output: string | null | undefined, maxLen = MAX_TEST_OUTPUT_LENGTH): string {
  if (!output) return '';
  return truncateContent(redactSecrets(output), maxLen);
}

/**
 * Sanitizes and truncates git diff.
 */
export function sanitizeDiff(diff: string | null | undefined, maxLen = MAX_DIFF_LENGTH): string {
  if (!diff) return '';
  return truncateContent(redactSecrets(diff), maxLen);
}
