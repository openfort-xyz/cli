import { Cli, z, Errors } from 'incur'
import type {
  CreatePolicyV2RequestScope,
  CreatePolicyV2RuleRequest,
  ListPoliciesScopeItem,
  PolicyV2CriterionRequest,
} from '@openfort/openfort-node'
import { varsSchema } from '../vars.js'

const policyScopes = ['project', 'account', 'transaction'] as const

// --- Templates ---

type PolicyTemplate = {
  description: string
  scope: CreatePolicyV2RequestScope
  rules: CreatePolicyV2RuleRequest[]
}

function buildEvmRules(chainIds?: number[]): CreatePolicyV2RuleRequest[] {
  const criteria: PolicyV2CriterionRequest[] = chainIds?.length
    ? [{ type: 'evmNetwork', operator: 'in', chainIds }]
    : []
  return [{ action: 'accept', operation: 'sponsorEvmTransaction', criteria }]
}

function buildSvmRules(networks?: string[]): CreatePolicyV2RuleRequest[] {
  const criteria: PolicyV2CriterionRequest[] = networks?.length
    ? [{ type: 'solNetwork', operator: 'in', networks }]
    : []
  return [{ action: 'accept', operation: 'sponsorSolTransaction', criteria }]
}

function buildAllRules(evmChainIds?: number[], svmNetworks?: string[]): CreatePolicyV2RuleRequest[] {
  return [
    ...buildEvmRules(evmChainIds),
    ...buildSvmRules(svmNetworks),
  ]
}

function buildSigningRules(evmChainIds?: number[], svmNetworks?: string[]): CreatePolicyV2RuleRequest[] {
  const evmCriteria: PolicyV2CriterionRequest[] = evmChainIds?.length
    ? [{ type: 'evmNetwork', operator: 'in', chainIds: evmChainIds }]
    : []
  const svmCriteria: PolicyV2CriterionRequest[] = svmNetworks?.length
    ? [{ type: 'solNetwork', operator: 'in', networks: svmNetworks }]
    : []
  return [
    { action: 'accept', operation: 'signEvmTransaction', criteria: evmCriteria },
    { action: 'accept', operation: 'sendEvmTransaction', criteria: evmCriteria },
    { action: 'accept', operation: 'signEvmTypedData', criteria: evmCriteria },
    { action: 'accept', operation: 'signEvmMessage', criteria: evmCriteria },
    { action: 'accept', operation: 'signSolTransaction', criteria: svmCriteria },
    { action: 'accept', operation: 'sendSolTransaction', criteria: svmCriteria },
    { action: 'accept', operation: 'signSolMessage', criteria: svmCriteria },
  ]
}

const POLICY_TEMPLATES: Record<string, (chainIds?: number[], svmNetworks?: string[]) => PolicyTemplate> = {
  'enable-evm': (chainIds) => ({
    description: chainIds?.length ? `Enable EVM gas sponsorship on chains ${chainIds.join(', ')}` : 'Enable EVM gas sponsorship',
    scope: 'project',
    rules: buildEvmRules(chainIds),
  }),
  'enable-svm': (_chainIds, svmNetworks) => ({
    description: svmNetworks?.length ? `Enable Solana gas sponsorship on ${svmNetworks.join(', ')}` : 'Enable Solana gas sponsorship',
    scope: 'project',
    rules: buildSvmRules(svmNetworks),
  }),
  'enable-all': (chainIds, svmNetworks) => ({
    description: 'Enable gas sponsorship (EVM + Solana)',
    scope: 'project',
    rules: buildAllRules(chainIds, svmNetworks),
  }),
  'allow-signing': (chainIds, svmNetworks) => ({
    description: 'Allow all signing operations',
    scope: 'project',
    rules: buildSigningRules(chainIds, svmNetworks),
  }),
}

const TEMPLATE_NAMES = Object.keys(POLICY_TEMPLATES) as [string, ...string[]]

// --- Helpers ---

function parseChainIds(raw: string | undefined): number[] | undefined {
  if (!raw) return undefined
  return raw.split(',').map(s => {
    const n = Number(s.trim())
    if (Number.isNaN(n)) throw new Errors.IncurError({ code: 'INVALID_CHAIN', message: `Invalid chain ID: ${s}` })
    return n
  })
}

function parseSvmNetworks(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined
  return raw.split(',').map(s => s.trim())
}

const policyOutput = z.object({
  id: z.string(),
  createdAt: z.number(),
  scope: z.string(),
  description: z.string().nullable(),
  enabled: z.boolean(),
  priority: z.number(),
})

function mapPolicy(p: { id: string; createdAt: number; scope: string; description: string | null; enabled: boolean; priority: number }) {
  return { id: p.id, createdAt: p.createdAt, scope: p.scope, description: p.description, enabled: p.enabled, priority: p.priority }
}

// --- CLI ---

export const policies = Cli.create('policies', {
  description: 'Manage access-control policies.',
  vars: varsSchema,
})

policies.command('list', {
  description: 'List policies.',
  options: z.object({
    limit: z.number().optional().describe('Max results'),
    skip: z.number().optional().describe('Offset'),
    scope: z.enum(policyScopes).optional().describe('Filter by scope'),
    enabled: z.boolean().optional().describe('Filter by enabled status'),
  }),
  alias: { limit: 'l' },
  examples: [
    { description: 'List all policies' },
    { options: { scope: 'project' as const, enabled: true }, description: 'List enabled project-scope policies' },
  ],
  output: z.object({
    data: z.array(z.object({
      id: z.string(),
      createdAt: z.number(),
      scope: z.string(),
      description: z.string().nullable(),
      accountId: z.string().nullable(),
      enabled: z.boolean(),
      priority: z.number(),
    })),
    total: z.number(),
  }),
  async run(c) {
    const scopeFilter: ListPoliciesScopeItem[] | undefined = c.options.scope
      ? [c.options.scope]
      : undefined
    const res = await c.var.openfort.policies.list({
      limit: c.options.limit,
      skip: c.options.skip,
      scope: scopeFilter,
      enabled: c.options.enabled,
    })
    return c.ok({
      data: res.data.map(p => ({
        id: p.id,
        createdAt: p.createdAt,
        scope: p.scope,
        description: p.description,
        accountId: p.accountId,
        enabled: p.enabled,
        priority: p.priority,
      })),
      total: res.total,
    })
  },
})

policies.command('create', {
  description: 'Create a policy. Use --template for common patterns, or --rules for custom JSON.',
  options: z.object({
    template: z.enum(TEMPLATE_NAMES).optional().describe('Template: enable-evm, enable-svm, enable-all, allow-signing'),
    chain: z.string().optional().describe('EVM chain IDs, comma-separated (e.g. 137,1,42161)'),
    network: z.string().optional().describe('Solana networks, comma-separated (e.g. mainnet-beta,devnet)'),
    scope: z.enum(policyScopes).optional().describe('Policy scope (default: project)'),
    description: z.string().optional().describe('Policy description'),
    priority: z.number().optional().describe('Priority (higher = evaluated first)'),
    operation: z.string().optional().describe('Operation (e.g. sponsorEvmTransaction, signSolTransaction)'),
    action: z.enum(['accept', 'reject']).optional().describe('Rule action (default: accept)'),
    rules: z.string().optional().describe('Rules as raw JSON string (advanced)'),
  }),
  output: policyOutput,
  examples: [
    {
      options: { template: 'enable-evm' as 'enable-evm', chain: '137' },
      description: 'Enable EVM sponsorship on Polygon',
    },
    {
      options: { template: 'enable-all' as 'enable-all' },
      description: 'Enable sponsorship for all chains',
    },
    {
      options: { template: 'allow-signing' as 'allow-signing', chain: '1,137' },
      description: 'Allow signing on Ethereum and Polygon',
    },
    {
      options: { scope: 'project' as const, operation: 'sponsorEvmTransaction', chain: '137,42161' },
      description: 'Inline flags: enable EVM sponsorship on Polygon and Arbitrum',
    },
    {
      options: {
        scope: 'project' as const,
        rules: '[{"action":"accept","operation":"sponsorEvmTransaction","criteria":[{"type":"evmNetwork","operator":"in","chainIds":[137]}]}]',
      },
      description: 'Custom rules as JSON (advanced)',
    },
  ],
  async run(c) {
    const chainIds = parseChainIds(c.options.chain)
    const svmNetworks = parseSvmNetworks(c.options.network)
    const template = c.options.template

    let scope: CreatePolicyV2RequestScope
    let rules: CreatePolicyV2RuleRequest[]
    let description = c.options.description

    if (template && template in POLICY_TEMPLATES) {
      const templateFn = POLICY_TEMPLATES[template]
      const tpl = templateFn(chainIds, svmNetworks)
      scope = (c.options.scope as CreatePolicyV2RequestScope) || tpl.scope
      rules = tpl.rules
      description = description || tpl.description
    } else if (c.options.operation) {
      scope = (c.options.scope as CreatePolicyV2RequestScope) || 'project'
      const action = c.options.action || 'accept'
      const criteria: PolicyV2CriterionRequest[] = []
      if (chainIds?.length) {
        criteria.push({ type: 'evmNetwork', operator: 'in', chainIds })
      }
      if (svmNetworks?.length) {
        criteria.push({ type: 'solNetwork', operator: 'in', networks: svmNetworks })
      }
      rules = [{ action, operation: c.options.operation, criteria }]
    } else if (c.options.rules) {
      scope = (c.options.scope as CreatePolicyV2RequestScope) || 'project'
      rules = JSON.parse(c.options.rules)
    } else {
      throw new Errors.IncurError({
        code: 'MISSING_RULES',
        message: 'Provide --template, --operation, or --rules to define policy rules.',
        hint: 'Examples:\n  openfort policies create --template enable-evm --chain 137\n  openfort policies create --operation sponsorEvmTransaction --chain 137\n  openfort policies create --rules \'[...]\'',
      })
    }

    const res = await c.var.openfort.policies.create({
      scope,
      description,
      priority: c.options.priority,
      rules,
    })

    return c.ok(
      mapPolicy(res),
      {
        cta: {
          description: 'Next steps:',
          commands: [
            { command: `policies get ${res.id}`, description: 'View this policy' },
            { command: `sponsorship create --policyId ${res.id}`, description: 'Create a fee sponsorship' },
            { command: `sponsorship auto`, description: 'Enable fee sponsorship (all chains by default)' },
          ],
        },
      },
    )
  },
})

policies.command('get', {
  description: 'Get a policy by ID.',
  args: z.object({
    id: z.string().describe('Policy ID (ply_...)'),
  }),
  examples: [
    { args: { id: 'ply_1a2b3c4d' }, description: 'Get policy details with rules' },
  ],
  output: z.object({
    id: z.string(),
    createdAt: z.number(),
    scope: z.string(),
    description: z.string().nullable(),
    accountId: z.string().nullable(),
    enabled: z.boolean(),
    priority: z.number(),
    rules: z.array(z.any()),
  }),
  async run(c) {
    const p = await c.var.openfort.policies.get(c.args.id)
    return c.ok(
      {
        id: p.id,
        createdAt: p.createdAt,
        scope: p.scope,
        description: p.description,
        accountId: p.accountId,
        enabled: p.enabled,
        priority: p.priority,
        rules: p.rules,
      },
      {
        cta: {
          description: 'Actions:',
          commands: [
            { command: `sponsorship create --policyId ${p.id} --name "${p.description || 'Gas Sponsor'}"`, description: 'Create a fee sponsorship for this policy' },
            { command: `policies update ${p.id} --enabled ${!p.enabled}`, description: `${p.enabled ? 'Disable' : 'Enable'} this policy` },
            { command: `policies delete ${p.id}`, description: 'Delete this policy' },
          ],
        },
      },
    )
  },
})

policies.command('update', {
  description: 'Update a policy.',
  args: z.object({
    id: z.string().describe('Policy ID (ply_...)'),
  }),
  options: z.object({
    description: z.string().optional().describe('New description'),
    enabled: z.boolean().optional().describe('Enable or disable'),
    priority: z.number().optional().describe('New priority'),
    rules: z.string().optional().describe('New rules as JSON string'),
  }),
  examples: [
    { args: { id: 'ply_1a2b3c4d' }, options: { enabled: false }, description: 'Disable a policy' },
    { args: { id: 'ply_1a2b3c4d' }, options: { priority: 10 }, description: 'Change policy priority' },
  ],
  output: policyOutput,
  async run(c) {
    const res = await c.var.openfort.policies.update(c.args.id, {
      description: c.options.description,
      enabled: c.options.enabled,
      priority: c.options.priority,
      rules: c.options.rules ? JSON.parse(c.options.rules) : undefined,
    })
    return c.ok(mapPolicy(res))
  },
})

policies.command('delete', {
  description: 'Delete a policy.',
  args: z.object({
    id: z.string().describe('Policy ID (ply_...)'),
  }),
  examples: [
    { args: { id: 'ply_1a2b3c4d' }, description: 'Delete a policy' },
  ],
  output: z.object({
    id: z.string(),
    deleted: z.boolean(),
  }),
  async run(c) {
    const res = await c.var.openfort.policies.delete(c.args.id)
    return c.ok({ id: res.id, deleted: res.deleted })
  },
})

policies.command('evaluate', {
  description: 'Pre-flight check if an operation would be allowed.',
  options: z.object({
    operation: z.string().describe('Operation to evaluate (e.g. signEvmTransaction)'),
    accountId: z.string().optional().describe('Account ID'),
  }),
  examples: [
    { options: { operation: 'signEvmTransaction', accountId: 'acc_1a2b3c4d' }, description: 'Check if EVM signing is allowed' },
    { options: { operation: 'sponsorEvmTransaction' }, description: 'Check if gas sponsorship is allowed' },
  ],
  output: z.object({
    allowed: z.boolean(),
    reason: z.string(),
    operation: z.string(),
    accountId: z.string().optional(),
    matchedPolicyId: z.string().optional(),
    matchedRuleId: z.string().optional(),
  }),
  async run(c) {
    const res = await c.var.openfort.policies.evaluate({
      operation: c.options.operation,
      accountId: c.options.accountId,
    })
    return c.ok({
      allowed: res.allowed,
      reason: res.reason,
      operation: res.operation,
      accountId: res.accountId,
      matchedPolicyId: res.matchedPolicyId,
      matchedRuleId: res.matchedRuleId,
    })
  },
})
