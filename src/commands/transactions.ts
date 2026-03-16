import { Cli, z } from 'incur'
import { varsSchema } from '../vars.js'

const transactionIntentItem = z.object({
  id: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  chainId: z.number(),
  abstractionType: z.string().describe('e.g. accountAbstractionV6, standard'),
  userOperationHash: z.string().optional(),
  response: z.object({
    createdAt: z.number(),
    blockNumber: z.number().optional(),
    transactionHash: z.string().optional(),
    gasUsed: z.string().optional(),
    gasFee: z.string().optional(),
    status: z.number().optional(),
    to: z.string().optional(),
    error: z.any().optional(),
  }).optional(),
  interactions: z.array(z.object({
    to: z.string().optional(),
    data: z.string().optional(),
    value: z.string().optional(),
  })).optional(),
  nextAction: z.object({
    type: z.string(),
    payload: z.any().optional(),
  }).optional(),
})

export const transactions = Cli.create('transactions', {
  description: 'Manage transaction intents.',
  vars: varsSchema,
})

transactions.command('list', {
  description: 'List transaction intents.',
  options: z.object({
    limit: z.number().optional().describe('Max results'),
    skip: z.number().optional().describe('Offset'),
  }),
  alias: { limit: 'l' },
  examples: [
    { description: 'List all transactions' },
    { options: { limit: 10 }, description: 'List last 10 transactions' },
  ],
  output: z.object({
    data: z.array(z.object({
      id: z.string(),
      createdAt: z.number(),
      updatedAt: z.number(),
      chainId: z.number(),
      abstractionType: z.string(),
    })),
    total: z.number(),
  }),
  async run(c) {
    const res = await c.var.openfort.transactionIntents.list({
      limit: c.options.limit,
      skip: c.options.skip,
    })
    return c.ok({
      data: res.data.map(t => ({
        id: t.id,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        chainId: t.chainId,
        abstractionType: t.abstractionType,
      })),
      total: res.total,
    })
  },
})

transactions.command('create', {
  description: 'Create a transaction intent.',
  options: z.object({
    account: z.string().describe('Account ID (acc_...)'),
    chainId: z.number().describe('Chain ID'),
    interactions: z.string().describe('Interactions as JSON: [{"to":"0x...","data":"0x...","value":"0"}]'),
    policy: z.string().optional().describe('Fee sponsorship ID (pol_...).'),
    signedAuthorization: z.string().optional().describe('Signed EIP-7702 authorization hex (for delegated accounts)'),
  }),
  output: transactionIntentItem,
  examples: [
    {
      options: {
        account: 'acc_1a2b3c4d',
        chainId: 137,
        interactions: '[{"to":"0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359","data":"0xa9059cbb000000...","value":"0"}]',
      },
      description: 'Transfer USDC on Polygon',
    },
    {
      options: {
        account: 'acc_1a2b3c4d',
        chainId: 137,
        interactions: '[{"to":"0x742d35Cc6634C0532925a3b844Bc9e7595f92cD5","value":"1000000000000000000"}]',
        policy: 'pol_1a2b3c4d',
      },
      description: 'Send 1 POL with gas sponsorship',
    },
  ],
  async run(c) {
    const interactions = JSON.parse(c.options.interactions)
    const res = await c.var.openfort.transactionIntents.create({
      account: c.options.account,
      chainId: c.options.chainId,
      interactions,
      policy: c.options.policy,
      signedAuthorization: c.options.signedAuthorization,
    })
    return c.ok(
      {
        id: res.id,
        createdAt: res.createdAt,
        updatedAt: res.updatedAt,
        chainId: res.chainId,
        abstractionType: res.abstractionType,
        userOperationHash: res.userOperationHash,
        response: res.response,
        interactions: res.interactions,
        nextAction: res.nextAction,
      },
      {
        cta: {
          description: 'Next steps:',
          commands: [
            { command: `transactions get ${res.id}`, description: 'Check transaction status' },
          ],
        },
      },
    )
  },
})

transactions.command('get', {
  description: 'Get a transaction intent by ID.',
  args: z.object({
    id: z.string().describe('Transaction intent ID (tin_...)'),
  }),
  examples: [
    { args: { id: 'tin_1a2b3c4d' }, description: 'Get transaction status and receipt' },
  ],
  output: transactionIntentItem,
  async run(c) {
    const t = await c.var.openfort.transactionIntents.get(c.args.id)
    return c.ok({
      id: t.id,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      chainId: t.chainId,
      abstractionType: t.abstractionType,
      userOperationHash: t.userOperationHash,
      response: t.response,
      interactions: t.interactions,
      nextAction: t.nextAction,
    })
  },
})

transactions.command('sign', {
  description: 'Sign and broadcast a transaction intent.',
  args: z.object({
    id: z.string().describe('Transaction intent ID (tin_...)'),
  }),
  options: z.object({
    signature: z.string().describe('Hex signature'),
    optimistic: z.boolean().optional().describe('Return before on-chain confirmation'),
  }),
  examples: [
    { args: { id: 'tin_1a2b3c4d' }, options: { signature: '0xabcd1234...' }, description: 'Sign and broadcast a transaction' },
    { args: { id: 'tin_1a2b3c4d' }, options: { signature: '0xabcd1234...', optimistic: true }, description: 'Sign without waiting for on-chain confirmation' },
  ],
  output: transactionIntentItem,
  async run(c) {
    const res = await c.var.openfort.transactionIntents.signature(c.args.id, {
      signature: c.options.signature,
      optimistic: c.options.optimistic,
    })
    return c.ok(
      {
        id: res.id,
        createdAt: res.createdAt,
        updatedAt: res.updatedAt,
        chainId: res.chainId,
        abstractionType: res.abstractionType,
        userOperationHash: res.userOperationHash,
        response: res.response,
        interactions: res.interactions,
        nextAction: res.nextAction,
      },
      {
        cta: {
          description: 'Next steps:',
          commands: [
            { command: `transactions get ${res.id}`, description: 'Check transaction status' },
          ],
        },
      },
    )
  },
})

transactions.command('estimate', {
  description: 'Estimate gas cost for a transaction.',
  options: z.object({
    account: z.string().describe('Account ID (acc_...)'),
    chainId: z.number().describe('Chain ID'),
    interactions: z.string().describe('Interactions as JSON'),
    policy: z.string().optional().describe('Fee sponsorship ID (pol_...)'),
  }),
  examples: [
    {
      options: { account: 'acc_1a2b3c4d', chainId: 137, interactions: '[{"to":"0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359","data":"0xa9059cbb...","value":"0"}]' },
      description: 'Estimate gas for a USDC transfer on Polygon',
    },
  ],
  output: z.object({
    estimatedTXGas: z.string(),
    estimatedTXGasFee: z.string(),
    estimatedTXGasFeeUSD: z.string(),
    estimatedTXGasFeeToken: z.string().optional(),
    gasPrice: z.string(),
  }),
  async run(c) {
    const interactions = JSON.parse(c.options.interactions)
    const res = await c.var.openfort.transactionIntents.estimateCost({
      account: c.options.account,
      chainId: c.options.chainId,
      interactions,
      policy: c.options.policy,
    })
    return c.ok({
      estimatedTXGas: res.estimatedTXGas,
      estimatedTXGasFee: res.estimatedTXGasFee,
      estimatedTXGasFeeUSD: res.estimatedTXGasFeeUSD,
      estimatedTXGasFeeToken: res.estimatedTXGasFeeToken,
      gasPrice: res.gasPrice,
    })
  },
})
