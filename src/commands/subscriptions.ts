import { Cli, z } from 'incur'
import type { APITopic } from '@openfort/openfort-node'
import { varsSchema } from '../vars.js'

const apiTopics = [
  'transaction_intent.broadcast',
  'transaction_intent.successful',
  'transaction_intent.cancelled',
  'transaction_intent.failed',
  'balance.project',
  'balance.contract',
  'balance.dev_account',
  'test',
  'user.created',
  'user.updated',
  'user.deleted',
  'account.created',
] as const satisfies readonly APITopic[]

const triggerItem = z.object({
  id: z.string(),
  createdAt: z.number(),
  target: z.string(),
  type: z.string(),
  subscription: z.string(),
  updatedAt: z.number().optional(),
})

const subscriptionItem = z.object({
  id: z.string(),
  createdAt: z.number(),
  topic: z.string(),
  triggers: z.array(triggerItem),
  updatedAt: z.number().optional(),
})

export const subscriptions = Cli.create('subscriptions', {
  description: 'Manage webhook subscriptions.',
  vars: varsSchema,
})

subscriptions.command('list', {
  description: 'List webhook subscriptions.',
  output: z.object({
    data: z.array(subscriptionItem),
    total: z.number(),
  }),
  async run(c) {
    const res = await c.var.openfort.subscriptions.list()
    return c.ok({
      data: res.data.map(s => ({
        id: s.id,
        createdAt: s.createdAt,
        topic: s.topic,
        triggers: s.triggers,
        updatedAt: s.updatedAt,
      })),
      total: res.total,
    })
  },
})

subscriptions.command('create', {
  description: 'Create a webhook subscription.',
  options: z.object({
    topic: z.enum(apiTopics).describe('Event topic'),
    triggers: z.string().describe('Triggers as JSON: [{"type":"...","url":"..."}]'),
  }),
  output: subscriptionItem,
  async run(c) {
    const triggers = JSON.parse(c.options.triggers)
    const res = await c.var.openfort.subscriptions.create({
      topic: c.options.topic,
      triggers,
    })
    return c.ok({
      id: res.id,
      createdAt: res.createdAt,
      topic: res.topic,
      triggers: res.triggers,
      updatedAt: res.updatedAt,
    })
  },
})

subscriptions.command('get', {
  description: 'Get a subscription by ID.',
  args: z.object({
    id: z.string().describe('Subscription ID (sub_...)'),
  }),
  output: subscriptionItem,
  async run(c) {
    const s = await c.var.openfort.subscriptions.get(c.args.id)
    return c.ok({
      id: s.id,
      createdAt: s.createdAt,
      topic: s.topic,
      triggers: s.triggers,
      updatedAt: s.updatedAt,
    })
  },
})

subscriptions.command('delete', {
  description: 'Delete a subscription.',
  args: z.object({
    id: z.string().describe('Subscription ID (sub_...)'),
  }),
  output: z.object({
    id: z.string(),
    deleted: z.boolean(),
  }),
  async run(c) {
    const res = await c.var.openfort.subscriptions.delete(c.args.id)
    return c.ok({ id: res.id, deleted: res.deleted })
  },
})
