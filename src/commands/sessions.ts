import { Cli, z } from 'incur'
import { varsSchema } from '../vars.js'

const sessionItem = z.object({
  id: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  address: z.string(),
  validAfter: z.string(),
  validUntil: z.string(),
  whitelist: z.array(z.string()).optional(),
  isActive: z.boolean(),
  nextAction: z.object({
    type: z.string(),
    payload: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
})

export const sessions = Cli.create('sessions', {
  description: 'Manage session keys.',
  vars: varsSchema,
})

sessions.command('list', {
  description: 'List session keys for a player.',
  options: z.object({
    player: z.string().describe('Player ID (pla_...)'),
    limit: z.number().optional().describe('Max results'),
    skip: z.number().optional().describe('Offset'),
  }),
  alias: { limit: 'l' },
  examples: [
    { options: { player: 'pla_1a2b3c4d' }, description: 'List sessions for a player' },
  ],
  output: z.object({
    data: z.array(z.object({
      id: z.string(),
      createdAt: z.number(),
      address: z.string(),
      isActive: z.boolean(),
    })),
    total: z.number(),
  }),
  async run(c) {
    const res = await c.var.openfort.sessions.list({
      player: c.options.player,
      limit: c.options.limit,
      skip: c.options.skip,
    })
    return c.ok({
      data: res.data.map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        address: s.address,
        isActive: s.isActive,
      })),
      total: res.total,
    })
  },
})

sessions.command('create', {
  description: 'Create a session key.',
  options: z.object({
    address: z.string().describe('Session key address'),
    chainId: z.number().describe('Chain ID'),
    validAfter: z.number().describe('Valid after (unix timestamp in seconds)'),
    validUntil: z.number().describe('Valid until (unix timestamp in seconds)'),
    player: z.string().optional().describe('Player ID (pla_...)'),
    account: z.string().optional().describe('Account ID (acc_...)'),
    limit: z.number().optional().describe('Max session uses'),
    policy: z.string().optional().describe('Fee sponsorship ID (pol_...)'),
    whitelist: z.string().optional().describe('Whitelisted contract addresses as JSON array'),
  }),
  examples: [
    {
      options: {
        address: '0x1234...', chainId: 137,
        validAfter: 1700000000, validUntil: 1700086400,
        player: 'pla_1a2b3c4d',
      },
      description: 'Create a 24h session key on Polygon',
    },
  ],
  output: sessionItem,
  async run(c) {
    const res = await c.var.openfort.sessions.create({
      address: c.options.address,
      chainId: c.options.chainId,
      validAfter: c.options.validAfter,
      validUntil: c.options.validUntil,
      player: c.options.player,
      account: c.options.account,
      limit: c.options.limit,
      policy: c.options.policy,
      whitelist: c.options.whitelist ? JSON.parse(c.options.whitelist) as string[] : undefined,
    })
    return c.ok(
      {
        id: res.id,
        createdAt: res.createdAt,
        updatedAt: res.updatedAt,
        address: res.address,
        validAfter: res.validAfter,
        validUntil: res.validUntil,
        whitelist: res.whitelist,
        isActive: res.isActive,
        nextAction: res.nextAction,
      },
      {
        cta: {
          description: 'Next steps:',
          commands: [
            { command: `sessions get ${res.id}`, description: 'View this session' },
          ],
        },
      },
    )
  },
})

sessions.command('get', {
  description: 'Get a session key by ID.',
  args: z.object({
    id: z.string().describe('Session ID (ses_...)'),
  }),
  examples: [
    { args: { id: 'ses_1a2b3c4d' }, description: 'Get session details' },
  ],
  output: sessionItem,
  async run(c) {
    const s = await c.var.openfort.sessions.get(c.args.id)
    return c.ok({
      id: s.id,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      address: s.address,
      validAfter: s.validAfter,
      validUntil: s.validUntil,
      whitelist: s.whitelist,
      isActive: s.isActive,
      nextAction: s.nextAction,
    })
  },
})

sessions.command('revoke', {
  description: 'Revoke a session key.',
  options: z.object({
    address: z.string().describe('Session key address to revoke'),
    chainId: z.number().describe('Chain ID'),
    player: z.string().optional().describe('Player ID (pla_...)'),
    policy: z.string().optional().describe('Fee sponsorship ID (pol_...)'),
  }),
  examples: [
    { options: { address: '0x1234...', chainId: 137 }, description: 'Revoke a session key' },
  ],
  output: sessionItem,
  async run(c) {
    const res = await c.var.openfort.sessions.revoke({
      address: c.options.address,
      chainId: c.options.chainId,
      player: c.options.player,
      policy: c.options.policy,
    })
    return c.ok({
      id: res.id,
      createdAt: res.createdAt,
      updatedAt: res.updatedAt,
      address: res.address,
      validAfter: res.validAfter,
      validUntil: res.validUntil,
      whitelist: res.whitelist,
      isActive: res.isActive,
      nextAction: res.nextAction,
    })
  },
})

sessions.command('sign', {
  description: 'Sign and broadcast a session userOperationHash.',
  args: z.object({
    id: z.string().describe('Session ID (ses_...)'),
  }),
  options: z.object({
    signature: z.string().describe('Hex signature'),
    optimistic: z.boolean().optional().describe('Return before on-chain confirmation'),
  }),
  examples: [
    { args: { id: 'ses_1a2b3c4d' }, options: { signature: '0xabcd1234...' }, description: 'Sign a session' },
  ],
  output: sessionItem,
  async run(c) {
    const res = await c.var.openfort.sessions.signature(c.args.id, {
      signature: c.options.signature,
      optimistic: c.options.optimistic,
    })
    return c.ok({
      id: res.id,
      createdAt: res.createdAt,
      updatedAt: res.updatedAt,
      address: res.address,
      validAfter: res.validAfter,
      validUntil: res.validUntil,
      whitelist: res.whitelist,
      isActive: res.isActive,
      nextAction: res.nextAction,
    })
  },
})
