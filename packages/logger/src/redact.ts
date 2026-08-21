/**
 * BACKEND.md Logging Requirements: never log passwords, tokens, secrets, PII.
 * Enforced structurally here — every field name in this list is redacted
 * recursively no matter which call site logs it, so this isn't discipline
 * developers have to remember at every `logger.info(...)` call.
 */
const REDACTED_KEY_PATTERN =
  /password|passwordhash|token|secret|authorization|apikey|api_key|jwt|refreshtoken|accesstoken/i;

const REDACTED = "[REDACTED]";
const MAX_DEPTH = 6;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH || value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (REDACTED_KEY_PATTERN.test(key)) {
      out[key] = REDACTED;
    } else {
      out[key] = redact(val, depth + 1);
    }
  }
  return out;
}
