import { describe, expect, it } from 'vitest'
import { rotateError } from './backend-wallet.js'

describe('rotateError', () => {
  it('points to the api_key:rotate scope on 403', () => {
    const error = rotateError(403, '{"error":{"message":"does not have the required permissions"}}')
    expect(error.code).toBe('ROTATE_SECRET_FAILED')
    expect(error.message).toContain('api_key:rotate')
    expect(error.message).toContain('openfort login')
    expect(error.retryable).toBe(false)
  })

  it('has no scope hint on other failures', () => {
    const error = rotateError(500, 'boom')
    expect(error.message).toContain('boom')
    expect(error.message).not.toContain('api_key:rotate')
    expect(error.retryable).toBe(true)
  })
})
