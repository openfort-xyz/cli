import { Cli, z } from 'incur'
import Openfort from '@openfort/openfort-node'
import { varsSchema } from './vars.js'
import { accounts } from './commands/accounts.js'
import { contracts } from './commands/contracts.js'
import { paymasters } from './commands/paymasters.js'
import { policies } from './commands/policies.js'
import { sponsorship } from './commands/sponsorship.js'
import { subscriptions } from './commands/subscriptions.js'
import { sessions } from './commands/sessions.js'
import { transactions } from './commands/transactions.js'
import { users } from './commands/users.js'

const cli = Cli.create('openfort', {
  version: '0.1.0',
  description: 'Openfort CLI — manage wallets, policies, and transactions.',
  vars: varsSchema,
  env: z.object({
    OPENFORT_API_KEY: z.string().describe('Openfort secret API key (sk_test_... or sk_live_...)'),
    OPENFORT_WALLET_SECRET: z.string().optional().describe('Wallet encryption secret'),
    OPENFORT_PUBLISHABLE_KEY: z.string().optional().describe('Publishable key for client-side ops'),
    OPENFORT_BASE_URL: z.string().optional().describe('Custom API base URL'),
  }),
  sync: {
    depth: 2,
    include: ['accounts', 'transactions', 'policies', 'sponsorship', 'contracts', 'users', 'sessions', 'subscriptions'],
    suggestions: [
      'create an EVM backend wallet',
      'list all accounts',
      'create a gas sponsorship policy',
      'list users',
      'estimate transaction gas cost',
    ],
  },
})

cli.use(async (c, next) => {
  c.set('openfort', new Openfort(c.env.OPENFORT_API_KEY, {
    walletSecret: c.env.OPENFORT_WALLET_SECRET,
    publishableKey: c.env.OPENFORT_PUBLISHABLE_KEY,
    basePath: c.env.OPENFORT_BASE_URL,
  }))
  await next()
})

cli
  .command(accounts)
  .command(contracts)
  .command(paymasters)
  .command(policies)
  .command(sponsorship)
  .command(sessions)
  .command(subscriptions)
  .command(transactions)
  .command(users)

export default cli
