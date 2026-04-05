import { describe, it, expect } from 'vitest'
import { safeParseJSON } from './utils.mjs'

describe('safeParseJSON', () => {
  it('parses valid JSON', () => {
    const result = safeParseJSON('{"name": "test", "value": 42}')
    expect(result).toEqual({ name: 'test', value: 42 })
  })

  it('strips markdown code fences with json label', () => {
    const result = safeParseJSON('```json\n{"name": "test"}\n```')
    expect(result).toEqual({ name: 'test' })
  })

  it('strips markdown code fences without label', () => {
    const result = safeParseJSON('```\n{"name": "test"}\n```')
    expect(result).toEqual({ name: 'test' })
  })

  it('handles trailing commas before closing brace', () => {
    const result = safeParseJSON('{"name": "test",}')
    expect(result).toEqual({ name: 'test' })
  })

  it('handles trailing commas before closing bracket', () => {
    const result = safeParseJSON('{"items": [1, 2, 3,]}')
    expect(result).toEqual({ items: [1, 2, 3] })
  })

  it('handles literal newlines in strings', () => {
    const result = safeParseJSON('{"text": "line1\nline2"}')
    expect(result).toEqual({ text: 'line1\nline2' })
  })

  it('extracts JSON from text with leading/trailing content', () => {
    const result = safeParseJSON('Here is your response:\n{"name": "test"}\nEnd of response')
    expect(result).toEqual({ name: 'test' })
  })

  it('handles complex nested objects', () => {
    const result = safeParseJSON(
      '{"grade": "A", "setup_score": 85, "suggestions": ["fix timing", "improve risk"], "nested": {"key": "value"}}'
    )
    expect(result).toEqual({
      grade: 'A',
      setup_score: 85,
      suggestions: ['fix timing', 'improve risk'],
      nested: { key: 'value' },
    })
  })

  it('throws on invalid JSON after all recovery attempts', () => {
    expect(() => safeParseJSON('not valid json at all {]')).toThrow()
  })
})
