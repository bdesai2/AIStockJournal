/**
 * Shared input validation utilities for all server route modules.
 * Keep all pattern definitions here so they stay in sync across routes.
 */

/** UUID v4 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Basic email sanity check.
 * Delegates full validation to Supabase / the auth layer;
 * this is just a first-pass guard against obviously malformed input.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Ticker symbols: 1–10 alphanumeric characters, optionally followed by
 * a dot + 1–6 characters (e.g. BRK.B, SPY, AAPL, BTC-USD).
 */
const TICKER_RE = /^[A-Za-z0-9]{1,10}([.\-][A-Za-z0-9]{1,6})?$/

/** Positive integer (for row/page IDs) */
const POS_INT_RE = /^[1-9]\d*$/

export function isValidUuid(val) {
  return typeof val === 'string' && UUID_RE.test(val)
}

export function isValidEmail(val) {
  return typeof val === 'string' && val.length <= 254 && EMAIL_RE.test(val)
}

export function isValidTicker(val) {
  return typeof val === 'string' && TICKER_RE.test(val)
}

export function isPositiveInt(val) {
  return typeof val === 'string' ? POS_INT_RE.test(val) : Number.isInteger(val) && val > 0
}

/**
 * Safe error message for client responses.
 * In production, only expose messages from 4xx errors (client mistakes);
 * mask 5xx internals with a generic string to prevent information disclosure.
 */
export function safeErrorMessage(err, statusCode) {
  if (process.env.NODE_ENV !== 'production') return err?.message ?? 'Internal server error'
  return statusCode < 500 ? (err?.message ?? 'Bad request') : 'Internal server error'
}
