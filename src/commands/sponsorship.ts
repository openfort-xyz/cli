import { Cli, z } from 'incur'
import type { FeeSponsorshipStrategy } from '@openfort/openfort-node'
import { varsSchema } from '../vars.js'

const sponsorSchemas = ['pay_for_user', 'charge_custom_tokens', 'fixed_rate'] as const

const sponsorshipItem = z.object({
  id: z.string(),
  createdAt: z.number(),
  name: z.string().nullable(),
  chainId: z.number().nullable(),
  enabled: z.boolean(),
  strategy: z.object({
    sponsorSchema: z.string(),
    tokenContract: z.string().optional(),
    tokenContractAmount: z.string().optional(),
    dynamicExchangeRate: z.boolean().optional(),
  }),
  paymasterId: z.string().nullable(),
  policyId: z.string().nullable(),
})

export const sponsorship = Cli.create('sponsorship', {
  description: 'Manage fee sponsorships for gas costs.',
  vars: varsSchema,
})

sponsorship.command('list', {
  description: 'List fee sponsorships.',
  options: z.object({
    limit: z.number().optional().describe('Max results'),
    skip: z.number().optional().describe('Offset'),
    enabled: z.boolean().optional().describe('Filter by enabled status'),
  }),
  alias: { limit: 'l' },
  output: z.object({
    data: z.array(sponsorshipItem),
    total: z.number(),
  }),
  async run(c) {
    const res = await c.var.openfort.feeSponsorship.list({
      limit: c.options.limit,
      skip: c.options.skip,
      enabled: c.options.enabled,
    })
    return c.ok({
      data: res.data.map(s => ({
        id: s.id,
        createdAt: s.createdAt,
        name: s.name,
        chainId: s.chainId,
        enabled: s.enabled,
        strategy: s.strategy,
        paymasterId: s.paymasterId,
        policyId: s.policyId,
      })),
      total: res.total,
    })
  },
})

sponsorship.command('create', {
  description: 'Create a fee sponsorship linked to a policy.',
  options: z.object({
    policyId: z.string().describe('Policy ID to link (ply_...)'),
    name: z.string().optional().describe('Sponsorship name'),
    strategy: z.enum(sponsorSchemas).default('pay_for_user').describe('Sponsorship strategy'),
    chainId: z.number().optional().describe('Chain ID'),
  }),
  output: sponsorshipItem,
  examples: [
    {
      options: { policyId: 'ply_...', strategy: 'pay_for_user' as const, name: 'Polygon Gas' },
      description: 'Create a pay-for-user sponsorship',
    },
  ],
  async run(c) {
    const strategy: FeeSponsorshipStrategy = { sponsorSchema: c.options.strategy }
    const res = await c.var.openfort.feeSponsorship.create({
      policyId: c.options.policyId,
      name: c.options.name,
      strategy,
      chainId: c.options.chainId,
    })
    return c.ok(
      {
        id: res.id,
        createdAt: res.createdAt,
        name: res.name,
        chainId: res.chainId,
        enabled: res.enabled,
        strategy: res.strategy,
        paymasterId: res.paymasterId,
        policyId: res.policyId,
      },
      {
        cta: {
          description: 'Next steps:',
          commands: [
            { command: `sponsorship get ${res.id}`, description: 'View this sponsorship' },
            { command: 'transactions create', description: 'Create a sponsored transaction' },
          ],
        },
      },
    )
  },
})

sponsorship.command('get', {
  description: 'Get a fee sponsorship by ID.',
  args: z.object({
    id: z.string().describe('Fee sponsorship ID'),
  }),
  output: sponsorshipItem,
  async run(c) {
    const s = await c.var.openfort.feeSponsorship.get(c.args.id)
    return c.ok({
      id: s.id,
      createdAt: s.createdAt,
      name: s.name,
      chainId: s.chainId,
      enabled: s.enabled,
      strategy: s.strategy,
      paymasterId: s.paymasterId,
      policyId: s.policyId,
    })
  },
})

sponsorship.command('update', {
  description: 'Update a fee sponsorship.',
  args: z.object({
    id: z.string().describe('Fee sponsorship ID'),
  }),
  options: z.object({
    name: z.string().optional().describe('New name'),
    strategy: z.enum(sponsorSchemas).optional().describe('New strategy'),
    policyId: z.string().optional().describe('New policy ID'),
  }),
  output: sponsorshipItem,
  async run(c) {
    const strategy: FeeSponsorshipStrategy | undefined = c.options.strategy
      ? { sponsorSchema: c.options.strategy }
      : undefined
    const res = await c.var.openfort.feeSponsorship.update(c.args.id, {
      name: c.options.name,
      strategy,
      policyId: c.options.policyId,
    })
    return c.ok({
      id: res.id,
      createdAt: res.createdAt,
      name: res.name,
      chainId: res.chainId,
      enabled: res.enabled,
      strategy: res.strategy,
      paymasterId: res.paymasterId,
      policyId: res.policyId,
    })
  },
})

sponsorship.command('enable', {
  description: 'Enable a fee sponsorship.',
  args: z.object({
    id: z.string().describe('Fee sponsorship ID'),
  }),
  output: sponsorshipItem,
  async run(c) {
    const res = await c.var.openfort.feeSponsorship.enable(c.args.id)
    return c.ok({
      id: res.id,
      createdAt: res.createdAt,
      name: res.name,
      chainId: res.chainId,
      enabled: res.enabled,
      strategy: res.strategy,
      paymasterId: res.paymasterId,
      policyId: res.policyId,
    })
  },
})

sponsorship.command('disable', {
  description: 'Disable a fee sponsorship.',
  args: z.object({
    id: z.string().describe('Fee sponsorship ID'),
  }),
  output: sponsorshipItem,
  async run(c) {
    const res = await c.var.openfort.feeSponsorship.disable(c.args.id)
    return c.ok({
      id: res.id,
      createdAt: res.createdAt,
      name: res.name,
      chainId: res.chainId,
      enabled: res.enabled,
      strategy: res.strategy,
      paymasterId: res.paymasterId,
      policyId: res.policyId,
    })
  },
})

sponsorship.command('delete', {
  description: 'Delete a fee sponsorship.',
  args: z.object({
    id: z.string().describe('Fee sponsorship ID'),
  }),
  output: z.object({
    id: z.string(),
    deleted: z.boolean(),
  }),
  async run(c) {
    const res = await c.var.openfort.feeSponsorship.delete(c.args.id)
    return c.ok({ id: res.id, deleted: res.deleted })
  },
})
