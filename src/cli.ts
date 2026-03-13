import { Cli, z, Errors } from 'incur'
import Openfort from '@openfort/openfort-node'
import { varsSchema } from './vars.js'
import { API_BASE_URL } from './constants.js'
import { loginConfig } from './commands/login.js'
import { accounts } from './commands/accounts.js'
import { contracts } from './commands/contracts.js'
import { paymasters } from './commands/paymasters.js'
import { policies } from './commands/policies.js'
import { sponsorship } from './commands/sponsorship.js'
import { subscriptions } from './commands/subscriptions.js'
import { sessions } from './commands/sessions.js'
import { transactions } from './commands/transactions.js'
import { shield } from './commands/shield.js'
import { users } from './commands/users.js'
import { walletKeys } from './commands/wallet-keys.js'

const cli = Cli.create('openfort', {
  version: '0.1.0',
  description: 'Openfort CLI — manage wallets, policies, and transactions. More details here https://www.openfort.io/docs/overview/building-with-cli',
  vars: varsSchema,
  env: z.object({
    OPENFORT_API_KEY: z.string().optional().describe('Openfort secret API key (sk_test_... or sk_live_...)'),
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

// Register login BEFORE middleware so it bypasses the API key check
cli.command('login', loginConfig as any)

cli.use(async (c, next) => {
  // Skip API key check for the login command
  const isLoginCommand = process.argv.slice(2).some((arg) => arg === 'login')
  if (isLoginCommand) {
    await next()
    return
  }

  const apiKey = process.env.OPENFORT_API_KEY
  if (!apiKey) {
    throw new Errors.IncurError({
      code: 'MISSING_API_KEY',
      message: 'OPENFORT_API_KEY environment variable is required.',
      hint: 'Run: openfort login',
    })
  }
  c.set('openfort', new Openfort(apiKey, {
    walletSecret: process.env.OPENFORT_WALLET_SECRET,
    publishableKey: process.env.OPENFORT_PUBLISHABLE_KEY,
    basePath: API_BASE_URL,
  }))
  await next()
})

cli
  .command(accounts)
  .command(contracts)
  .command(paymasters)
  .command(policies)
  .command(shield)
  .command(sponsorship)
  .command(sessions)
  .command(subscriptions)
  .command(transactions)
  .command(users)
  .command(walletKeys)

export default cli
