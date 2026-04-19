import { z } from 'zod'

/**
 * Sanitize string input to prevent XSS attacks
 * Removes or escapes potentially dangerous HTML characters
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, (char) => {
      const map: Record<string, string> = { '<': '&lt;', '>': '&gt;' }
      return map[char] || char
    })
    .trim()
}

/**
 * Validate email format
 */
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .max(255, 'Email too long')
  .transform((val) => val.toLowerCase().trim())

/**
 * Validate password strength
 * - Min 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Password must contain a special character')

/**
 * Validate ticker symbol (4-5 uppercase letters)
 */
export const tickerSchema = z
  .string()
  .min(1, 'Ticker required')
  .max(5, 'Ticker too long')
  .regex(/^[A-Z0-9]+$/, 'Ticker must be uppercase alphanumeric')
  .transform((val) => val.toUpperCase())

/**
 * Validate URL format
 */
export const urlSchema = z
  .string()
  .url('Invalid URL format')
  .startsWith('https://', 'URL must use HTTPS')
  .or(z.string().regex(/^\//, 'URL must be relative path or HTTPS'))

/**
 * Validate numeric fields (prices, quantities)
 */
export const positiveNumberSchema = z
  .number()
  .positive('Must be greater than 0')
  .finite('Must be a valid number')

/**
 * Validate percentage (0-100)
 */
export const percentageSchema = z
  .number()
  .min(0, 'Percentage must be >= 0')
  .max(100, 'Percentage must be <= 100')

/**
 * Validate ISO date string
 */
export const isoDateSchema = z
  .string()
  .datetime()
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))

/**
 * Check if input contains SQL injection patterns
 */
export function detectSQLInjection(input: string): boolean {
  const sqlPatterns = [
    /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bEXEC\b|\bEXECUTE\b)/i,
    /['";\\]/,
    /(-{2}|\/\*|\*\/)/,
  ]
  return sqlPatterns.some((pattern) => pattern.test(input))
}

/**
 * Validate trade form input
 */
export const tradeInputSchema = z.object({
  ticker: tickerSchema,
  asset_type: z.enum(['stock', 'option', 'etf', 'crypto']),
  direction: z.enum(['long', 'short']),
  entry_price: positiveNumberSchema,
  exit_price: positiveNumberSchema.optional(),
  quantity: positiveNumberSchema,
  entry_date: isoDateSchema,
  setup_notes: z.string().max(5000, 'Notes too long').optional(),
  entry_notes: z.string().max(5000, 'Notes too long').optional(),
  exit_notes: z.string().max(5000, 'Notes too long').optional(),
})

/**
 * Rate limiting helper (client-side, for UX)
 * Server-side rate limiting should also be implemented
 */
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map()

  /**
   * Check if action is allowed
   * Returns true if within limit, false if exceeded
   */
  isAllowed(key: string, maxAttempts: number, windowMs: number): boolean {
    const now = Date.now()
    const attempts = this.attempts.get(key) || []

    // Remove old attempts outside the window
    const recent = attempts.filter((time) => now - time < windowMs)

    if (recent.length >= maxAttempts) {
      return false
    }

    // Record this attempt
    recent.push(now)
    this.attempts.set(key, recent)
    return true
  }

  /**
   * Reset attempts for a key
   */
  reset(key: string): void {
    this.attempts.delete(key)
  }

  /**
   * Get remaining attempts
   */
  getRemainingAttempts(key: string, maxAttempts: number, windowMs: number): number {
    const now = Date.now()
    const attempts = this.attempts.get(key) || []
    const recent = attempts.filter((time) => now - time < windowMs)
    return Math.max(0, maxAttempts - recent.length)
  }
}

// Global rate limiters for common operations
export const loginLimiter = new RateLimiter()
export const exportLimiter = new RateLimiter()
export const deleteLimiter = new RateLimiter()
