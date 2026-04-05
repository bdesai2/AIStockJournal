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
  // Strip markdown code fences (Claude sometimes ignores "no markdown" instruction)
  let cleaned = raw
    .replace(/^```(?:json)?\s*\n?/m, '')  // Opening fence with optional json label
    .replace(/\n?```\s*$/m, '')            // Closing fence with optional trailing whitespace
    .trim()

  try {
    return JSON.parse(cleaned)
  } catch (err) {
    // Try fixing common Claude formatting issues
    let fixed = cleaned
      .replace(/,\s*}/g, '}')     // Remove trailing commas before }
      .replace(/,\s*]/g, ']')     // Remove trailing commas before ]

    try {
      return JSON.parse(fixed)
    } catch {
      // Try escaping unescaped quotes and fixing newlines in strings
      // Replace literal newlines with escaped newlines
      fixed = cleaned.replace(/\n/g, '\\n')

      try {
        return JSON.parse(fixed)
      } catch {
        // Last resort: find the JSON object boundaries and extract valid JSON
        // Look for opening { and closing }
        const jsonStart = fixed.indexOf('{')
        const jsonEnd = fixed.lastIndexOf('}')

        if (jsonStart !== -1 && jsonEnd > jsonStart) {
          const extracted = fixed.substring(jsonStart, jsonEnd + 1)
          try {
            return JSON.parse(extracted)
          } catch {
            throw new Error(`JSON parse failed: ${err.message}\nFirst 300 chars: ${cleaned.substring(0, 300)}`)
          }
        }

        throw new Error(`JSON parse failed: ${err.message}\nFirst 300 chars: ${cleaned.substring(0, 300)}`)
      }
    }
  }
}
