import { Cli, z, Errors } from 'incur'
import type { CreatePolicyV2RequestScope, CreatePolicyV2RuleRequest, FeeSponsorshipStrategy, PolicyV2CriterionRequest } from '@openfort/openfort-node'
import { varsSchema } from '../vars.js'

const sponsorSchemas = ['pay_for_user', 'charge_custom_tokens', 'fixed_rate'] as const
const sponsorTypes = ['evm', 'svm', 'all'] as const

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
  description: 'Manage fee sponsorship strategies linked to policies.',
  vars: varsSchema,
})

sponsorship.command('auto', {
  description: 'The fastest way to sponsor gas.',
  options: z.object({
    type: z.enum(sponsorTypes).default('all').describe('Sponsor type: evm, svm, or all'),
    chain: z.string().optional().describe('EVM chain IDs, comma-separated (e.g. 137,1,42161)'),
    network: z.string().optional().describe('Solana networks, comma-separated (e.g. mainnet-beta,devnet)'),
    name: z.string().optional().describe('Sponsorship name'),
    strategy: z.enum(sponsorSchemas).default('pay_for_user').describe('Sponsorship strategy'),
  }),
  output: z.object({
    policyId: z.string(),
    sponsorships: z.array(z.object({
      id: z.string(),
      chainId: z.number().nullable(),
    })),
    type: z.string(),
  }),
  examples: [
    {
      options: { chain: '137' },
      description: 'Sponsor EVM gas on Polygon',
    },
    {
      options: { chain: '137,1,42161', name: 'Multi-chain Sponsor' },
      description: 'Sponsor EVM gas on Polygon, Ethereum, and Arbitrum',
    },
    {
      options: { type: 'svm' as 'svm' },
      description: 'Sponsor all Solana transactions',
    },
    {
      options: { type: 'all' as 'all' },
      description: 'Sponsor all transactions (EVM + Solana)',
    },
  ],
  async run(c) {
    const chainIds = c.options.chain
      ? c.options.chain.split(',').map(s => {
        const n = Number(s.trim())
        if (Number.isNaN(n)) throw new Errors.IncurError({ code: 'INVALID_CHAIN', message: `Invalid chain ID: ${s}` })
        return n
      })
      : undefined
    const svmNetworks = c.options.network
      ? c.options.network.split(',').map(s => s.trim())
      : undefined

    // Build rules based on type
    const rules: CreatePolicyV2RuleRequest[] = []
    const type = c.options.type

    if (type === 'evm' || type === 'all') {
      const criteria: PolicyV2CriterionRequest[] = chainIds?.length
        ? [{ type: 'evmNetwork', operator: 'in', chainIds }]
        : []
      rules.push({ action: 'accept', operation: 'sponsorEvmTransaction', criteria })
    }
    if (type === 'svm' || type === 'all') {
      const criteria: PolicyV2CriterionRequest[] = svmNetworks?.length
        ? [{ type: 'solNetwork', operator: 'in', networks: svmNetworks }]
        : []
      rules.push({ action: 'accept', operation: 'sponsorSolTransaction', criteria })
    }

    const chainLabel = chainIds?.length ? ` on chains ${chainIds.join(', ')}` : ''
    const networkLabel = svmNetworks?.length ? ` on ${svmNetworks.join(', ')}` : ''
    const description = `Gas sponsorship (${type})${chainLabel}${networkLabel}`

    // Step 1: Create policy
    const scope: CreatePolicyV2RequestScope = 'project'
    const policy = await c.var.openfort.policies.create({ scope, description, rules })

    // Step 2: Create fee sponsorship(s) — one per chain, or one without chainId
    const feeSponsorshipStrategy: FeeSponsorshipStrategy = { sponsorSchema: c.options.strategy }
    const chainList = chainIds?.length ? chainIds : [undefined]
    const sponsorships = await Promise.all(
      chainList.map(async (cid) => {
        const sp = await c.var.openfort.feeSponsorship.create({
          policyId: policy.id,
          name: c.options.name || description,
          strategy: feeSponsorshipStrategy,
          chainId: cid,
        })
        return { id: sp.id, chainId: sp.chainId }
      }),
    )

    return c.ok(
      {
        policyId: policy.id,
        sponsorships,
        type,
      },
      {
        cta: {
          description: 'Next steps:',
          commands: [
            { command: `sponsorship get ${sponsorships[0].id}`, description: 'View sponsorship details' },
            { command: `policies get ${policy.id}`, description: 'View policy rules' },
            { command: 'transactions create', description: 'Create a sponsored transaction' },
          ],
        },
      },
    )
  },
})

sponsorship.command('list', {
  description: 'List fee sponsorships.',
  options: z.object({
    limit: z.number().optional().describe('Max results'),
    skip: z.number().optional().describe('Offset'),
    enabled: z.boolean().optional().describe('Filter by enabled status'),
  }),
  alias: { limit: 'l' },
  examples: [
    { description: 'List all sponsorships' },
    { options: { enabled: true }, description: 'List active sponsorships only' },
  ],
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
      options: { policyId: 'ply_1a2b3c4d', strategy: 'pay_for_user' as const, name: 'Polygon Gas Sponsor' },
      description: 'Sponsor gas fees for users on Polygon',
    },
    {
      options: { policyId: 'ply_1a2b3c4d', strategy: 'charge_custom_tokens' as const, chainId: 137 },
      description: 'Pay gas with custom tokens on chain 137',
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
    id: z.string().describe('Fee sponsorship ID (pol_...)'),
  }),
  examples: [
    { args: { id: 'pol_1a2b3c4d' }, description: 'Get sponsorship details' },
  ],
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
    id: z.string().describe('Fee sponsorship ID (pol_...)'),
  }),
  options: z.object({
    name: z.string().optional().describe('New name'),
    strategy: z.enum(sponsorSchemas).optional().describe('New strategy'),
    policyId: z.string().optional().describe('New policy ID'),
  }),
  examples: [
    { args: { id: 'pol_1a2b3c4d' }, options: { name: 'Mainnet Gas Sponsor' }, description: 'Rename a sponsorship' },
  ],
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
    id: z.string().describe('Fee sponsorship ID (pol_...)'),
  }),
  examples: [
    { args: { id: 'pol_1a2b3c4d' }, description: 'Enable a sponsorship' },
  ],
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
    id: z.string().describe('Fee sponsorship ID (pol_...)'),
  }),
  examples: [
    { args: { id: 'pol_1a2b3c4d' }, description: 'Disable a sponsorship' },
  ],
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
    id: z.string().describe('Fee sponsorship ID (pol_...)'),
  }),
  examples: [
    { args: { id: 'pol_1a2b3c4d' }, description: 'Delete a sponsorship' },
  ],
  output: z.object({
    id: z.string(),
    deleted: z.boolean(),
  }),
  async run(c) {
    const res = await c.var.openfort.feeSponsorship.delete(c.args.id)
    return c.ok({ id: res.id, deleted: res.deleted })
  },
})
