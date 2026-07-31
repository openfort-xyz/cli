import { Errors } from 'incur'

/**
 * Parse a JSON-valued CLI option, converting a raw SyntaxError into a
 * user-facing error that names the offending flag.
 */
export function parseJsonOption<T>(flag: string, value: string): T {
  try {
    return JSON.parse(value) as T
  } catch (error) {
    const detail = error instanceof SyntaxError ? `: ${error.message}` : ''
    throw new Errors.IncurError({
      code: 'INVALID_JSON_OPTION',
      message: `Invalid JSON in --${flag}${detail}`,
      hint: 'Check quoting and escaping. See the command examples for the expected shape.',
    })
  }
}
