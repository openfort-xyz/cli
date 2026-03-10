import { Cli, z } from 'incur'
import type {
  GetAccountsV2ChainType,
  GetAccountsV2Custody,
} from '@openfort/openfort-node'
import { varsSchema } from '../vars.js'

// -- EVM sub-CLI --

const evm = Cli.create('evm', {
  description: 'EVM wallet management.',
  vars: varsSchema,
})

evm.command('create', {
  description: 'Create a new EVM backend wallet.',
  output: z.object({
    id: z.string().describe('Account ID'),
    address: z.string().describe('Wallet address'),
    custody: z.string().describe('Custody type'),
  }),
  async run(c) {
    const account = await c.var.openfort.accounts.evm.backend.create()
    return c.ok(
      { id: account.id, address: account.address, custody: account.custody },
      {
        cta: {
          description: 'Next steps:',
          commands: [
            { command: `accounts evm get ${account.id}`, description: 'View this account' },
            { command: 'policies create', description: 'Create an access policy' },
          ],
        },
      },
    )
  },
})

evm.command('list', {
  description: 'List EVM backend wallets.',
  options: z.object({
    limit: z.number().optional().describe('Max results'),
    skip: z.number().optional().describe('Offset'),
  }),
  alias: { limit: 'l' },
  output: z.object({
    accounts: z.array(z.object({
      id: z.string(),
      address: z.string(),
      custody: z.string(),
    })),
    total: z.number().optional(),
  }),
  async run(c) {
    const res = await c.var.openfort.accounts.evm.backend.list({
      limit: c.options.limit,
      skip: c.options.skip,
    })
    return c.ok({
      accounts: res.accounts.map(a => ({
        id: a.id,
        address: a.address,
        custody: a.custody,
      })),
      total: res.total,
    })
  },
})

evm.command('get', {
  description: 'Get an EVM backend wallet by ID or address.',
  args: z.object({
    id: z.string().describe('Account ID or address'),
  }),
  output: z.object({
    id: z.string(),
    address: z.string(),
    custody: z.string(),
  }),
  async run(c) {
    const a = await c.var.openfort.accounts.evm.backend.get({ id: c.args.id })
    return c.ok({
      id: a.id,
      address: a.address,
      custody: a.custody,
    })
  },
})

evm.command('sign', {
  description: 'Sign data with an EVM backend wallet.',
  args: z.object({
    id: z.string().describe('Account ID (acc_...)'),
  }),
  options: z.object({
    data: z.string().describe('Data to sign (hex-encoded)'),
  }),
  alias: { data: 'd' },
  output: z.object({
    account: z.string(),
    signature: z.string(),
  }),
  examples: [
    {
      args: { id: 'acc_abc123' },
      options: { data: '0x1234abcd' },
      description: 'Sign a message hash with a backend wallet',
    },
  ],
  async run(c) {
    const signature = await c.var.openfort.accounts.evm.backend.sign({
      id: c.args.id,
      data: c.options.data,
    })
    return c.ok({ account: c.args.id, signature })
  },
})

evm.command('delete', {
  description: 'Delete an EVM backend wallet.',
  args: z.object({
    id: z.string().describe('Account ID'),
  }),
  output: z.object({
    id: z.string(),
    deleted: z.boolean(),
  }),
  async run(c) {
    const res = await c.var.openfort.accounts.evm.backend.delete(c.args.id)
    return c.ok({ id: res.id, deleted: res.deleted })
  },
})

// -- Solana sub-CLI --

const solana = Cli.create('solana', {
  description: 'Solana wallet management.',
  vars: varsSchema,
})

solana.command('create', {
  description: 'Create a new Solana backend wallet.',
  output: z.object({
    id: z.string().describe('Account ID'),
    address: z.string().describe('Wallet address'),
    custody: z.string().describe('Custody type'),
  }),
  async run(c) {
    const account = await c.var.openfort.accounts.solana.backend.create()
    return c.ok(
      { id: account.id, address: account.address, custody: account.custody },
      {
        cta: {
          description: 'Next steps:',
          commands: [
            { command: `accounts solana get ${account.id}`, description: 'View this account' },
          ],
        },
      },
    )
  },
})

solana.command('list', {
  description: 'List Solana backend wallets.',
  options: z.object({
    limit: z.number().optional().describe('Max results'),
    skip: z.number().optional().describe('Offset'),
  }),
  alias: { limit: 'l' },
  output: z.object({
    accounts: z.array(z.object({
      id: z.string(),
      address: z.string(),
      custody: z.string(),
    })),
    total: z.number().optional(),
  }),
  async run(c) {
    const res = await c.var.openfort.accounts.solana.backend.list({
      limit: c.options.limit,
      skip: c.options.skip,
    })
    return c.ok({
      accounts: res.accounts.map(a => ({
        id: a.id,
        address: a.address,
        custody: a.custody,
      })),
      total: res.total,
    })
  },
})

solana.command('get', {
  description: 'Get a Solana backend wallet by ID or address.',
  args: z.object({
    id: z.string().describe('Account ID or address'),
  }),
  output: z.object({
    id: z.string(),
    address: z.string(),
    custody: z.string(),
  }),
  async run(c) {
    const a = await c.var.openfort.accounts.solana.backend.get({ id: c.args.id })
    return c.ok({
      id: a.id,
      address: a.address,
      custody: a.custody,
    })
  },
})

solana.command('sign', {
  description: 'Sign data with a Solana backend wallet.',
  args: z.object({
    id: z.string().describe('Account ID (acc_...)'),
  }),
  options: z.object({
    data: z.string().describe('Data to sign (base64-encoded)'),
  }),
  alias: { data: 'd' },
  output: z.object({
    account: z.string(),
    signature: z.string(),
  }),
  examples: [
    {
      args: { id: 'acc_abc123' },
      options: { data: 'SGVsbG8gV29ybGQ=' },
      description: 'Sign a message with a Solana backend wallet',
    },
  ],
  async run(c) {
    const signature = await c.var.openfort.accounts.solana.backend.sign(c.args.id, c.options.data)
    return c.ok({ account: c.args.id, signature })
  },
})

solana.command('delete', {
  description: 'Delete a Solana backend wallet.',
  args: z.object({
    id: z.string().describe('Account ID'),
  }),
  output: z.object({
    id: z.string(),
    deleted: z.boolean(),
  }),
  async run(c) {
    const res = await c.var.openfort.accounts.solana.backend.delete(c.args.id)
    return c.ok({ id: res.id, deleted: res.deleted })
  },
})

// -- Accounts root --

const accounts = Cli.create('accounts', {
  description: 'Manage wallets and accounts.',
  vars: varsSchema,
})

accounts.command('list', {
  description: 'List all accounts across chains.',
  options: z.object({
    limit: z.number().optional().describe('Max results'),
    skip: z.number().optional().describe('Offset'),
    chainType: z.enum(['EVM', 'SVM']).optional().describe('Filter by chain type'),
    custody: z.enum(['Developer', 'User']).optional().describe('Filter by custody'),
  }),
  alias: { limit: 'l' },
  output: z.object({
    data: z.array(z.object({
      id: z.string(),
      wallet: z.string().describe('Wallet ID'),
      accountType: z.string().describe('Account type'),
      address: z.string(),
      ownerAddress: z.string().optional(),
      chainType: z.string(),
      chainId: z.number().optional(),
      custody: z.string(),
      createdAt: z.number(),
      updatedAt: z.number(),
    })),
    total: z.number(),
  }),
  async run(c) {
    const res = await c.var.openfort.accounts.list({
      limit: c.options.limit,
      skip: c.options.skip,
      chainType: c.options.chainType satisfies GetAccountsV2ChainType | undefined,
      custody: c.options.custody satisfies GetAccountsV2Custody | undefined,
    })
    return c.ok({
      data: res.data.map(a => ({
        id: a.id,
        wallet: a.wallet,
        accountType: a.accountType,
        address: a.address,
        ownerAddress: a.ownerAddress,
        chainType: a.chainType,
        chainId: a.chainId,
        custody: a.custody,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
      total: res.total,
    })
  },
})

accounts.command(evm)
accounts.command(solana)

export { accounts }
