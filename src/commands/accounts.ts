import { Cli, z, Errors, middleware } from 'incur'
import type {
  GetAccountsV2ChainType,
  GetAccountsV2Custody,
  Interaction,
} from '@openfort/openfort-node'
import { varsSchema } from '../vars.js'

const requireWallet = middleware<typeof varsSchema>((c, next) => {
  const missing: string[] = []
  if (!process.env.OPENFORT_WALLET_SECRET) missing.push('OPENFORT_WALLET_SECRET')
  if (!process.env.OPENFORT_PUBLISHABLE_KEY) missing.push('OPENFORT_PUBLISHABLE_KEY')
  if (missing.length > 0) {
    return c.error({
      code: 'MISSING_CREDENTIALS',
      message: `Missing required credentials: ${missing.join(', ')}`,
      cta: {
        description: 'Set up wallet credentials:',
        commands: [{ command: 'backend-wallet setup', description: 'Set up signing keys for backend wallets' }],
      },
    })
  }
  return next()
})

// -- EVM sub-CLI --

const evm = Cli.create('evm', {
  description: 'EVM wallet management.',
  vars: varsSchema,
})

evm.command('create', {
  description: 'Create a new EVM backend wallet.',
  examples: [
    { description: 'Create a new EVM backend wallet (developer custody)' },
  ],
  hint: 'Requires OPENFORT_WALLET_SECRET and OPENFORT_PUBLISHABLE_KEY.',
  middleware: [requireWallet],
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
  examples: [
    { description: 'List all EVM backend wallets' },
    { options: { limit: 5 }, description: 'Show first 5 wallets' },
  ],
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

evm.command('list-delegated', {
  description: 'List EVM delegated accounts.',
  options: z.object({
    limit: z.number().optional().describe('Max results'),
    skip: z.number().optional().describe('Offset'),
  }),
  alias: { limit: 'l' },
  examples: [
    { description: 'List all EVM delegated accounts' },
    { options: { limit: 5 }, description: 'Show first 5 accounts' },
  ],
  output: z.object({
    accounts: z.array(z.object({
      id: z.string(),
      address: z.string(),
      custody: z.string(),
    })),
    total: z.number().optional(),
  }),
  async run(c) {
    const res = await c.var.openfort.accounts.evm.list({
      accountType: 'Delegated Account',
      limit: c.options.limit,
      skip: c.options.skip,
    })
    return c.ok({
      accounts: res.data.map(a => ({
        id: a.id,
        address: a.address,
        custody: a.custody,
      })),
      total: res.total,
    })
  },
})

evm.command('list-smart', {
  description: 'List EVM smart accounts.',
  options: z.object({
    limit: z.number().optional().describe('Max results'),
    skip: z.number().optional().describe('Offset'),
  }),
  alias: { limit: 'l' },
  examples: [
    { description: 'List all EVM smart accounts' },
    { options: { limit: 5 }, description: 'Show first 5 accounts' },
  ],
  output: z.object({
    accounts: z.array(z.object({
      id: z.string(),
      address: z.string(),
      custody: z.string(),
    })),
    total: z.number().optional(),
  }),
  async run(c) {
    const res = await c.var.openfort.accounts.evm.list({
      accountType: 'Smart Account',
      limit: c.options.limit,
      skip: c.options.skip,
    })
    return c.ok({
      accounts: res.data.map(a => ({
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
  examples: [
    { args: { id: 'acc_1a2b3c4d' }, description: 'Get wallet by ID' },
  ],
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

evm.command('delete', {
  description: 'Delete an EVM backend wallet.',
  args: z.object({
    id: z.string().describe('Account ID (acc_...)'),
  }),
  examples: [
    { args: { id: 'acc_1a2b3c4d' }, description: 'Delete a wallet' },
  ],
  output: z.object({
    id: z.string(),
    deleted: z.boolean(),
  }),
  async run(c) {
    const res = await c.var.openfort.accounts.evm.backend.delete(c.args.id)
    return c.ok({ id: res.id, deleted: res.deleted })
  },
})

evm.command('update', {
  description: 'Upgrade an EVM backend wallet to a delegated account (EIP-7702).',
  args: z.object({
    id: z.string().describe('Account ID (acc_...)'),
  }),
  options: z.object({
    chainId: z.number().describe('Chain ID to deploy on'),
    implementationType: z.string().describe('Target implementation type (e.g. CaliburV9)'),
  }),
  examples: [
    { args: { id: 'acc_1a2b3c4d' }, options: { chainId: 8453, implementationType: 'CaliburV9' }, description: 'Upgrade to delegated account on Base' },
  ],
  output: z.object({
    id: z.string(),
    address: z.string(),
    accountType: z.string(),
    chainId: z.number().optional(),
    chainType: z.string(),
  }),
  async run(c) {
    // First get the account to obtain walletId
    const account = await c.var.openfort.accounts.evm.backend.get({ id: c.args.id })
    const res = await c.var.openfort.accounts.evm.backend.update({
      walletId: account.walletId,
      chainId: c.options.chainId,
      accountId: account.id,
      implementationType: c.options.implementationType,
    })
    return c.ok({
      id: res.id,
      address: res.address,
      accountType: res.accountType,
      chainId: res.chainId,
      chainType: res.chainType,
    },
      {
        cta: {
          description: 'Next steps:',
          commands: [
            { command: `accounts evm list-delegated`, description: 'List all delegated accounts' },
          ],
        },
      },
    )
  },
})

evm.command('sign', {
  description: 'Sign data with an EVM backend wallet.',
  args: z.object({
    id: z.string().describe('Account ID (acc_...)'),
  }),
  options: z.object({
    data: z.string().describe('Hex-encoded data to sign'),
  }),
  examples: [
    { args: { id: 'acc_1a2b3c4d' }, options: { data: '0xdeadbeef' }, description: 'Sign a message hash' },
  ],
  hint: 'Requires OPENFORT_WALLET_SECRET and OPENFORT_PUBLISHABLE_KEY.',
  middleware: [requireWallet],
  output: z.object({
    signature: z.string(),
  }),
  async run(c) {
    const signature = await c.var.openfort.accounts.evm.backend.sign({
      id: c.args.id,
      data: c.options.data,
    })
    return c.ok({ signature })
  },
})

evm.command('import', {
  description: 'Import a private key as an EVM backend wallet.',
  options: z.object({
    privateKey: z.string().describe('Private key (hex string)'),
  }),
  examples: [
    { options: { privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' }, description: 'Import a private key' },
  ],
  hint: 'Requires OPENFORT_WALLET_SECRET and OPENFORT_PUBLISHABLE_KEY.',
  middleware: [requireWallet],
  output: z.object({
    id: z.string(),
    address: z.string(),
    custody: z.string(),
  }),
  async run(c) {
    const account = await c.var.openfort.accounts.evm.backend.import({
      privateKey: c.options.privateKey,
    })
    return c.ok({
      id: account.id,
      address: account.address,
      custody: account.custody,
    })
  },
})

evm.command('export', {
  description: 'Export an EVM backend wallet private key.',
  args: z.object({
    id: z.string().describe('Account ID (acc_...)'),
  }),
  examples: [
    { args: { id: 'acc_1a2b3c4d' }, description: 'Export private key' },
  ],
  middleware: [requireWallet],
  output: z.object({
    privateKey: z.string(),
  }),
  async run(c) {
    const privateKey = await c.var.openfort.accounts.evm.backend.export({
      id: c.args.id,
    })
    return c.ok({ privateKey })
  },
})

evm.command('send-transaction', {
  description: 'Send a gasless EVM transaction (auto-delegates via EIP-7702 if needed).',
  args: z.object({
    id: z.string().describe('Account ID (acc_...)'),
  }),
  options: z.object({
    chainId: z.number().describe('Chain ID'),
    interactions: z.string().describe('Interactions as JSON: [{"to":"0x...","data":"0x...","value":"0"}]'),
    policy: z.string().optional().describe('Fee sponsorship ID (pol_...)'),
  }),
  examples: [
    {
      args: { id: 'acc_1a2b3c4d' },
      options: {
        chainId: 8453,
        interactions: '[{"to":"0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359","data":"0xa9059cbb...","value":"0"}]',
      },
      description: 'Send a gasless transaction on Base',
    },
  ],
  middleware: [requireWallet],
  output: z.object({
    id: z.string(),
    chainId: z.number(),
    transactionHash: z.string().optional(),
  }),
  async run(c) {
    const account = await c.var.openfort.accounts.evm.backend.get({ id: c.args.id })
    const interactions: Array<Interaction> = JSON.parse(c.options.interactions)
    const res = await c.var.openfort.accounts.evm.backend.sendTransaction({
      account,
      chainId: c.options.chainId,
      interactions,
      policy: c.options.policy,
    })
    return c.ok({
      id: res.id,
      chainId: res.chainId,
      transactionHash: res.response?.transactionHash,
    })
  },
})

// -- Solana sub-CLI --

const solana = Cli.create('solana', {
  description: 'Solana wallet management.',
  vars: varsSchema,
})

solana.command('create', {
  description: 'Create a new Solana backend wallet.',
  examples: [
    { description: 'Create a new Solana backend wallet (developer custody)' },
  ],
  hint: 'Requires OPENFORT_WALLET_SECRET and OPENFORT_PUBLISHABLE_KEY.',
  middleware: [requireWallet],
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
  examples: [
    { description: 'List all Solana wallets' },
  ],
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
  examples: [
    { args: { id: 'acc_1a2b3c4d' }, description: 'Get wallet by ID' },
  ],
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
  hint: 'Requires OPENFORT_WALLET_SECRET and OPENFORT_PUBLISHABLE_KEY.',
  middleware: [requireWallet],
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
    id: z.string().describe('Account ID (acc_...)'),
  }),
  examples: [
    { args: { id: 'acc_1a2b3c4d' }, description: 'Delete a wallet' },
  ],
  output: z.object({
    id: z.string(),
    deleted: z.boolean(),
  }),
  async run(c) {
    const res = await c.var.openfort.accounts.solana.backend.delete(c.args.id)
    return c.ok({ id: res.id, deleted: res.deleted })
  },
})

solana.command('import', {
  description: 'Import a private key as a Solana backend wallet.',
  options: z.object({
    privateKey: z.string().describe('Private key (hex-encoded 32 bytes or base58)'),
  }),
  examples: [
    { options: { privateKey: 'abc123...' }, description: 'Import a Solana private key' },
  ],
  hint: 'Requires OPENFORT_WALLET_SECRET and OPENFORT_PUBLISHABLE_KEY.',
  middleware: [requireWallet],
  output: z.object({
    id: z.string(),
    address: z.string(),
    custody: z.string(),
  }),
  async run(c) {
    const account = await c.var.openfort.accounts.solana.backend.import({
      privateKey: c.options.privateKey,
    })
    return c.ok({
      id: account.id,
      address: account.address,
      custody: account.custody,
    })
  },
})

solana.command('export', {
  description: 'Export a Solana backend wallet private key.',
  args: z.object({
    id: z.string().describe('Account ID (acc_...)'),
  }),
  examples: [
    { args: { id: 'acc_1a2b3c4d' }, description: 'Export private key' },
  ],
  middleware: [requireWallet],
  output: z.object({
    privateKey: z.string(),
  }),
  async run(c) {
    const privateKey = await c.var.openfort.accounts.solana.backend.export({
      id: c.args.id,
    })
    return c.ok({ privateKey })
  },
})

solana.command('transfer', {
  description: 'Transfer SOL or SPL tokens.',
  args: z.object({
    id: z.string().describe('Account ID (acc_...)'),
  }),
  options: z.object({
    to: z.string().describe('Destination address (base58)'),
    amount: z.string().describe('Amount in base units (lamports for SOL)'),
    token: z.string().optional().describe('Token: "sol" (default), "usdc", or mint address'),
    cluster: z.enum(['devnet', 'mainnet-beta']).default('mainnet-beta').describe('Cluster: devnet or mainnet-beta'),
  }),
  examples: [
    {
      args: { id: 'acc_1a2b3c4d' },
      options: { to: 'FDx9mf...', amount: '1000000', cluster: 'devnet' },
      description: 'Transfer 0.001 SOL on devnet',
    },
    {
      args: { id: 'acc_1a2b3c4d' },
      options: { to: 'FDx9mf...', amount: '1000000', token: 'usdc', cluster: 'devnet' },
      description: 'Transfer 1 USDC on devnet',
    },
  ],
  middleware: [requireWallet],
  output: z.object({
    signature: z.string(),
  }),
  async run(c) {
    const account = await c.var.openfort.accounts.solana.backend.get({ id: c.args.id })
    const res = await c.var.openfort.accounts.solana.backend.transfer({
      account,
      to: c.options.to,
      amount: BigInt(c.options.amount),
      token: c.options.token,
      cluster: c.options.cluster,
    })
    return c.ok({ signature: res.signature })
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
  examples: [
    { description: 'List all accounts across chains' },
    { options: { chainType: 'EVM' as const }, description: 'Filter to EVM accounts only' },
    { options: { custody: 'Developer' as const, limit: 10 }, description: 'List developer-custody wallets' },
  ],
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
