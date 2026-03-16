import { Cli, z } from 'incur'
import { getOpenfort } from '../client.js'

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
] as const

const apiTriggerTypes = ['webhook', 'email'] as const

// -- Triggers sub-CLI --

const triggers = Cli.create('triggers', {
  description: 'Manage subscription triggers.',
})

triggers.command('list', {
  description: 'List triggers for a subscription.',
  args: z.object({
    subscriptionId: z.string().describe('Subscription ID (sub_...)'),
  }),
  examples: [
    { args: { subscriptionId: 'sub_1a2b3c4d' }, description: 'List triggers' },
  ],
  output: z.object({
    data: z.array(z.object({
      id: z.string(),
      createdAt: z.number(),
      target: z.string(),
      type: z.string(),
    })),
  }),
  async run(c) {
    const res = await getOpenfort().triggers.list(c.args.subscriptionId)
    return c.ok({
      data: res.data.map((t) => ({
        id: t.id,
        createdAt: t.createdAt,
        target: t.target,
        type: t.type,
      })),
    })
  },
})

triggers.command('create', {
  description: 'Create a trigger for a subscription.',
  args: z.object({
    subscriptionId: z.string().describe('Subscription ID (sub_...)'),
  }),
  options: z.object({
    target: z.string().describe('Webhook URL or email address'),
    type: z.enum(apiTriggerTypes).default('webhook').describe('Trigger type: webhook or email'),
  }),
  examples: [
    {
      args: { subscriptionId: 'sub_1a2b3c4d' },
      options: { target: 'https://myapp.com/webhooks', type: 'webhook' },
      description: 'Create a webhook trigger',
    },
  ],
  output: z.object({
    id: z.string(),
    createdAt: z.number(),
    target: z.string(),
    type: z.string(),
  }),
  async run(c) {
    const res = await getOpenfort().triggers.create(c.args.subscriptionId, {
      target: c.options.target,
      type: c.options.type,
    })
    return c.ok({
      id: res.id,
      createdAt: res.createdAt,
      target: res.target,
      type: res.type,
    })
  },
})

triggers.command('get', {
  description: 'Get a trigger by ID.',
  args: z.object({
    subscriptionId: z.string().describe('Subscription ID (sub_...)'),
    triggerId: z.string().describe('Trigger ID (tri_...)'),
  }),
  examples: [
    { args: { subscriptionId: 'sub_1a2b3c4d', triggerId: 'tri_1a2b3c4d' }, description: 'Get trigger details' },
  ],
  output: z.object({
    id: z.string(),
    createdAt: z.number(),
    target: z.string(),
    type: z.string(),
  }),
  async run(c) {
    const t = await getOpenfort().triggers.get(c.args.subscriptionId, c.args.triggerId)
    return c.ok({
      id: t.id,
      createdAt: t.createdAt,
      target: t.target,
      type: t.type,
    })
  },
})

triggers.command('delete', {
  description: 'Delete a trigger.',
  args: z.object({
    subscriptionId: z.string().describe('Subscription ID (sub_...)'),
    triggerId: z.string().describe('Trigger ID (tri_...)'),
  }),
  examples: [
    { args: { subscriptionId: 'sub_1a2b3c4d', triggerId: 'tri_1a2b3c4d' }, description: 'Delete a trigger' },
  ],
  output: z.object({
    id: z.string(),
    deleted: z.boolean(),
  }),
  async run(c) {
    const res = await getOpenfort().triggers.delete(c.args.subscriptionId, c.args.triggerId)
    return c.ok({ id: res.id, deleted: res.deleted })
  },
})

// -- Subscriptions root --

export const subscriptions = Cli.create('subscriptions', {
  description: 'Manage webhook subscriptions.',
})

subscriptions.command('list', {
  description: 'List webhook subscriptions.',
  examples: [
    { description: 'List all subscriptions' },
  ],
  output: z.object({
    data: z.array(z.object({
      id: z.string(),
      createdAt: z.number(),
      topic: z.string(),
      triggers: z.array(z.object({
        id: z.string(),
        target: z.string(),
        type: z.string(),
      })),
    })),
    total: z.number(),
  }),
  async run(c) {
    const res = await getOpenfort().subscriptions.list()
    return c.ok({
      data: res.data.map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        topic: s.topic,
        triggers: s.triggers,
      })),
      total: res.total,
    })
  },
})

subscriptions.command('create', {
  description: 'Create a webhook subscription.',
  options: z.object({
    topic: z.enum(apiTopics).describe('Event topic (e.g. transaction_intent.successful, user.created)'),
    triggers: z.string().describe('Triggers as JSON: [{"type":"webhook","target":"https://..."}]'),
  }),
  examples: [
    {
      options: {
        topic: 'transaction_intent.successful',
        triggers: '[{"type":"webhook","target":"https://myapp.com/webhooks/openfort"}]',
      },
      description: 'Get notified when transactions succeed',
    },
  ],
  output: z.object({
    id: z.string(),
    createdAt: z.number(),
    topic: z.string(),
    triggers: z.array(z.object({
      id: z.string(),
      target: z.string(),
      type: z.string(),
    })),
  }),
  async run(c) {
    const parsedTriggers: Array<{ type: string; target: string }> = JSON.parse(c.options.triggers)
    const res = await getOpenfort().subscriptions.create({
      topic: c.options.topic,
      triggers: parsedTriggers,
    })
    return c.ok(
      {
        id: res.id,
        createdAt: res.createdAt,
        topic: res.topic,
        triggers: res.triggers,
      },
      {
        cta: {
          description: 'Next steps:',
          commands: [
            { command: `subscriptions get ${res.id}`, description: 'View this subscription' },
            { command: 'subscriptions list', description: 'List all subscriptions' },
          ],
        },
      },
    )
  },
})

subscriptions.command('get', {
  description: 'Get a subscription by ID.',
  args: z.object({
    id: z.string().describe('Subscription ID (sub_...)'),
  }),
  examples: [
    { args: { id: 'sub_1a2b3c4d' }, description: 'Get subscription details' },
  ],
  output: z.object({
    id: z.string(),
    createdAt: z.number(),
    topic: z.string(),
    triggers: z.array(z.object({
      id: z.string(),
      target: z.string(),
      type: z.string(),
    })),
  }),
  async run(c) {
    const s = await getOpenfort().subscriptions.get(c.args.id)
    return c.ok({
      id: s.id,
      createdAt: s.createdAt,
      topic: s.topic,
      triggers: s.triggers,
    })
  },
})

subscriptions.command('delete', {
  description: 'Delete a subscription.',
  args: z.object({
    id: z.string().describe('Subscription ID (sub_...)'),
  }),
  examples: [
    { args: { id: 'sub_1a2b3c4d' }, description: 'Delete a subscription' },
  ],
  output: z.object({
    id: z.string(),
    deleted: z.boolean(),
  }),
  async run(c) {
    const res = await getOpenfort().subscriptions.delete(c.args.id)
    return c.ok({ id: res.id, deleted: res.deleted })
  },
})

subscriptions.command(triggers)
