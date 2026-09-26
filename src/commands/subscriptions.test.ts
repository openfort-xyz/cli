import { z } from 'incur'
import { describe, expect, it } from 'vitest'
import { apiTopics } from './subscriptions.js'

describe('apiTopics', () => {
  const topic = z.enum(apiTopics)

  it.each([
    'solana_transaction.broadcast',
    'solana_transaction.successful',
    'solana_transaction.failed',
    'funding.session.updated',
    'transaction.submitted',
    'transaction.succeeded',
    'transaction.failed',
  ])('accepts %s', (value) => {
    expect(topic.parse(value)).toBe(value)
  })

  it('rejects topics the API does not support', () => {
    expect(topic.safeParse('transaction.unknown').success).toBe(false)
  })
})
