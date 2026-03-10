import { Cli, z } from 'incur'
import type {
  CreatePolicyV2RequestScope,
  ListPoliciesScopeItem,
} from '@openfort/openfort-node'
import { varsSchema } from '../vars.js'

const policyScopes = ['project', 'account', 'transaction'] as const

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
  description: 'Create a policy with criteria-based rules.',
  options: z.object({
    scope: z.enum(policyScopes).describe('Policy scope'),
    description: z.string().optional().describe('Policy description'),
    priority: z.number().optional().describe('Priority (higher = evaluated first)'),
    rules: z.string().describe('Rules as JSON string'),
  }),
  output: z.object({
    id: z.string(),
    createdAt: z.number(),
    scope: z.string(),
    description: z.string().nullable(),
    enabled: z.boolean(),
    priority: z.number(),
  }),
  examples: [
    {
      options: {
        scope: 'project' as const,
        rules: '[{"action":"accept","operation":"sponsorEvmTransaction","criteria":[{"type":"evmNetwork","operator":"in","chainIds":[137]}]}]',
      },
      description: 'Create a policy to sponsor transactions on Polygon',
    },
  ],
  async run(c) {
    const rules = JSON.parse(c.options.rules)
    const scope: CreatePolicyV2RequestScope = c.options.scope
    const res = await c.var.openfort.policies.create({
      scope,
      description: c.options.description,
      priority: c.options.priority,
      rules,
    })
    return c.ok(
      {
        id: res.id,
        createdAt: res.createdAt,
        scope: res.scope,
        description: res.description,
        enabled: res.enabled,
        priority: res.priority,
      },
      {
        cta: {
          description: 'Next steps:',
          commands: [
            { command: `policies get ${res.id}`, description: 'View this policy' },
            { command: `sponsorship create --policyId ${res.id}`, description: 'Create a fee sponsorship' },
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
    return c.ok({
      id: p.id,
      createdAt: p.createdAt,
      scope: p.scope,
      description: p.description,
      accountId: p.accountId,
      enabled: p.enabled,
      priority: p.priority,
      rules: p.rules,
    })
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
  output: z.object({
    id: z.string(),
    createdAt: z.number(),
    scope: z.string(),
    description: z.string().nullable(),
    enabled: z.boolean(),
    priority: z.number(),
  }),
  async run(c) {
    const res = await c.var.openfort.policies.update(c.args.id, {
      description: c.options.description,
      enabled: c.options.enabled,
      priority: c.options.priority,
      rules: c.options.rules ? JSON.parse(c.options.rules) : undefined,
    })
    return c.ok({
      id: res.id,
      createdAt: res.createdAt,
      scope: res.scope,
      description: res.description,
      enabled: res.enabled,
      priority: res.priority,
    })
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
