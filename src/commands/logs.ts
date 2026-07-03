import { Cli, z } from 'incur'
import {
  getProjectLogs,
  getWebhookLogsByProjectId,
  listSubscriptionLogs,
  type GetProjectLogsParams,
  type ListSubscriptionLogsParams,
} from '@openfort/openfort-node'
import { getOpenfort } from '../client.js'
import { apiTopics } from './subscriptions.js'

const apiStatuses = ['success', 'failed'] as const
const sortOrders = ['asc', 'desc'] as const

const requestLogItem = z.object({
  id: z.string(),
  timestamp: z.string(),
  event: z.string(),
  status: z.number(),
  responseTime: z.number(),
  requestBody: z.unknown().optional(),
  responseData: z.unknown().optional(),
})

const requestLogList = z.object({
  data: z.array(requestLogItem),
  total: z.number(),
})

const subscriptionLogItem = z.object({
  id: z.string(),
  createdAt: z.number(),
  topic: z.string(),
  status: z.string(),
  subscription: z.string(),
  trigger: z.string(),
  requestID: z.string(),
})

const subscriptionLogList = z.object({
  data: z.array(subscriptionLogItem),
  total: z.number(),
})

export function toRequestLogList(res: Awaited<ReturnType<typeof getProjectLogs>>) {
  return {
    data: res.data.map((l) => ({
      id: l.id,
      timestamp: l.timestamp,
      event: l.event,
      status: l.status,
      responseTime: l.response_time,
      requestBody: l.request_body,
      responseData: l.response_data,
    })),
    total: res.total,
  }
}

export function toSubscriptionLogList(res: Awaited<ReturnType<typeof listSubscriptionLogs>>) {
  return {
    data: res.data.map((l) => ({
      id: l.id,
      createdAt: l.createdAt,
      topic: l.topic,
      status: l.status,
      subscription: l.subscription,
      trigger: l.trigger,
      requestID: l.requestID,
    })),
    total: res.total,
  }
}

export const logs = Cli.create('logs', {
  description: 'Inspect API request, webhook, and subscription logs to debug integrations.',
})

logs.command('list', {
  description: 'List project API request logs. Use this to see what calls were made and how they responded.',
  options: z.object({
    method: z.array(z.string()).optional().describe('Filter by HTTP method (e.g. GET, POST). Repeatable.'),
    id: z.string().optional().describe('Filter by request ID'),
    limit: z.number().optional().describe('Max results'),
    skip: z.number().optional().describe('Offset'),
  }),
  alias: { limit: 'l' },
  examples: [
    { description: 'List recent API request logs' },
    { options: { limit: 20 }, description: 'Inspect the last 20 API requests when debugging' },
    { options: { method: ['POST'] }, description: 'Only POST requests' },
  ],
  output: requestLogList,
  async run(c) {
    // Configures the shared SDK client the standalone log functions depend on.
    getOpenfort()
    // The SDK's GetProjectLogsParams type lags the API, which also accepts limit/skip.
    const params: GetProjectLogsParams & { limit?: number; skip?: number } = {
      method: c.options.method,
      id: c.options.id,
      limit: c.options.limit,
      skip: c.options.skip,
    }
    const res = await getProjectLogs(params)
    return c.ok(toRequestLogList(res), {
      cta: {
        description: 'Next steps:',
        commands: [
          { command: 'logs webhook', description: 'Inspect webhook delivery logs' },
          { command: 'logs subscriptions', description: 'Inspect triggered subscription logs' },
        ],
      },
    })
  },
})

logs.command('webhook', {
  description: 'List webhook delivery logs. Use this to see whether webhook deliveries succeeded or failed.',
  examples: [
    { description: 'List webhook delivery logs' },
  ],
  output: requestLogList,
  async run(c) {
    getOpenfort()
    const res = await getWebhookLogsByProjectId()
    return c.ok(toRequestLogList(res))
  },
})

logs.command('subscriptions', {
  description: 'List triggered subscription logs. Use this to see which subscriptions fired and their outcome.',
  options: z.object({
    limit: z.number().optional().describe('Max results'),
    skip: z.number().optional().describe('Offset'),
    order: z.enum(sortOrders).optional().describe('Sort order by creation date'),
    topic: z.enum(apiTopics).optional().describe('Filter by event topic'),
    status: z.enum(apiStatuses).optional().describe('Filter by delivery status'),
    object: z.string().optional().describe('Filter by related object ID'),
    subscription: z.string().optional().describe('Filter by subscription ID (sub_...)'),
    trigger: z.string().optional().describe('Filter by trigger ID (tri_...)'),
    requestID: z.string().optional().describe('Filter by request ID'),
  }),
  alias: { limit: 'l' },
  examples: [
    { description: 'List triggered subscription logs' },
    { options: { status: 'failed', limit: 20 }, description: 'Find failed webhook triggers when debugging' },
    { options: { subscription: 'sub_1a2b3c4d' }, description: 'Logs for a specific subscription' },
  ],
  output: subscriptionLogList,
  async run(c) {
    getOpenfort()
    const params: ListSubscriptionLogsParams = {
      limit: c.options.limit,
      skip: c.options.skip,
      order: c.options.order,
      topic: c.options.topic,
      status: c.options.status,
      object: c.options.object,
      subscription: c.options.subscription,
      trigger: c.options.trigger,
      requestID: c.options.requestID,
    }
    const res = await listSubscriptionLogs(params)
    return c.ok(toSubscriptionLogList(res))
  },
})
