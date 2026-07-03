import { describe, expect, it } from 'vitest'
import { toRequestLogList, toSubscriptionLogList } from './logs.js'

describe('toRequestLogList', () => {
  it('maps snake_case API fields to the camelCase output shape', () => {
    const result = toRequestLogList({
      object: 'list',
      url: '/v1/logs',
      start: 0,
      end: 1,
      total: 1,
      data: [
        {
          id: 'log_1',
          timestamp: '2026-06-17T13:01:57.735Z',
          event: 'POST /v1/accounts',
          status: 200,
          response_time: 96,
          request_body: { type: 'sk' },
          response_data: { id: 'acc_1' },
        },
      ],
    })

    expect(result).toEqual({
      total: 1,
      data: [
        {
          id: 'log_1',
          timestamp: '2026-06-17T13:01:57.735Z',
          event: 'POST /v1/accounts',
          status: 200,
          responseTime: 96,
          requestBody: { type: 'sk' },
          responseData: { id: 'acc_1' },
        },
      ],
    })
  })

  it('preserves an empty result set', () => {
    const result = toRequestLogList({ object: 'list', url: '/v1/logs', start: 0, end: 0, total: 0, data: [] })
    expect(result).toEqual({ total: 0, data: [] })
  })

  it('keeps undefined request/response bodies undefined', () => {
    const result = toRequestLogList({
      object: 'list',
      url: '/v1/logs',
      start: 0,
      end: 1,
      total: 1,
      data: [{ id: 'log_2', timestamp: 't', event: 'GET /v1/logs', status: 500, response_time: 12, request_body: undefined, response_data: undefined }],
    })
    expect(result.data[0]).toMatchObject({ requestBody: undefined, responseData: undefined })
  })
})

describe('toSubscriptionLogList', () => {
  it('maps triggered subscription log fields to the output shape', () => {
    const result = toSubscriptionLogList({
      object: 'list',
      url: '/v1/subscriptions/logs',
      start: 0,
      end: 1,
      total: 1,
      data: [
        {
          id: 'sublog_1',
          object: 'log',
          createdAt: 1718629317,
          topic: 'transaction_intent.failed',
          status: 'failed',
          subscription: 'sub_1',
          trigger: 'tri_1',
          requestID: 'req_1',
        },
      ],
    })

    expect(result).toEqual({
      total: 1,
      data: [
        {
          id: 'sublog_1',
          createdAt: 1718629317,
          topic: 'transaction_intent.failed',
          status: 'failed',
          subscription: 'sub_1',
          trigger: 'tri_1',
          requestID: 'req_1',
        },
      ],
    })
  })

  it('preserves an empty result set', () => {
    const result = toSubscriptionLogList({ object: 'list', url: '/v1/subscriptions/logs', start: 0, end: 0, total: 0, data: [] })
    expect(result).toEqual({ total: 0, data: [] })
  })
})
