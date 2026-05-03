/**
 * Utility Functions
 */

/**
 * Parse JSON response from Claude, stripping markdown fences if present
 * Claude sometimes wraps JSON in ```json ... ``` despite instructions
 * @param {string} raw - Raw JSON string from API response
 * @returns {object} Parsed JSON object
 */
export function safeParseJSON(raw) {
  const cleaned = String(raw ?? '')
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim()

  const parseCandidate = (candidate) => {
    const direct = candidate.trim()
    if (!direct) return null

    try {
      return JSON.parse(direct)
    } catch {
      const withoutTrailingCommas = direct
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')

      try {
        return JSON.parse(withoutTrailingCommas)
      } catch {
        return null
      }
    }
  }

  const extractBalancedJSONObject = (text) => {
    let depth = 0
    let start = -1
    let inString = false
    let escaped = false

    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i]

      if (escaped) {
        escaped = false
        continue
      }

      if (ch === '\\') {
        escaped = true
        continue
      }

      if (ch === '"') {
        inString = !inString
        continue
      }

      if (inString) continue

      if (ch === '{') {
        if (depth === 0) start = i
        depth += 1
      } else if (ch === '}') {
        if (depth > 0) depth -= 1
        if (depth === 0 && start !== -1) {
          return text.slice(start, i + 1)
        }
      }
    }

    return null
  }

  const attempts = [
    cleaned,
    cleaned.replace(/\n/g, '\\n'),
  ]

  for (const attempt of attempts) {
    const parsed = parseCandidate(attempt)
    if (parsed !== null) return parsed

    const extracted = extractBalancedJSONObject(attempt)
    if (extracted) {
      const extractedParsed = parseCandidate(extracted)
      if (extractedParsed !== null) return extractedParsed
    }
  }

  throw new Error(`JSON parse failed: unable to parse model response\nFirst 300 chars: ${cleaned.substring(0, 300)}`)
}
