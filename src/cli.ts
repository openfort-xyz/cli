import { readFileSync } from 'node:fs'
import { Cli, z, Errors } from 'incur'
import Openfort from '@openfort/openfort-node'
import { varsSchema } from './vars.js'
import { API_BASE_URL } from './constants.js'
import { CREDENTIALS_PATH } from './config.js'
import { loadEnvFile } from './env.js'
import { login } from './commands/login.js'
import { accounts } from './commands/accounts.js'
import { contracts } from './commands/contracts.js'
import { paymasters } from './commands/paymasters.js'
import { policies } from './commands/policies.js'
import { sponsorship } from './commands/sponsorship.js'
import { subscriptions } from './commands/subscriptions.js'
import { sessions } from './commands/sessions.js'
import { transactions } from './commands/transactions.js'
import { embeddedWallet } from './commands/embedded-wallet.js'
import { users } from './commands/users.js'
import { backendWallet } from './commands/backend-wallet.js'
import { message } from './commands/message.js'

const pkg: { version: string } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'))

const cli = Cli.create('openfort', {
  version: pkg.version,
  description: 'Openfort CLI — manage wallets, policies, and transactions from the terminal.',
  vars: varsSchema,
  env: z.object({
    OPENFORT_API_KEY: z.string().optional().describe('Openfort secret API key (sk_test_... or sk_live_...)'),
    OPENFORT_WALLET_SECRET: z.string().optional().describe('Wallet encryption secret'),
    OPENFORT_PUBLISHABLE_KEY: z.string().optional().describe('Publishable key for client-side ops'),
    OPENFORT_BASE_URL: z.string().optional().describe('Custom API base URL'),
  }),
  sync: {
    depth: 2,
    include: ['_root', 'accounts', 'transactions', 'policies', 'sponsorship', 'contracts', 'users', 'sessions', 'subscriptions', 'backend-wallet', 'embedded-wallet'],
    suggestions: [
      'create an EVM backend wallet',
      'list all accounts',
      'create a policy for gas sponsorship',
      'list users',
      'estimate transaction gas cost',
    ],
  },
  mcp: {
    agents: ['claude-code', 'cursor', 'amp'],
  },
})

// Register login BEFORE middleware so it bypasses the API key check
cli.command(login)

cli.use(async (c, next) => {
  // Skip API key check for the login command
  const isLoginCommand = process.argv.slice(2).some((arg) => arg === 'login')
  if (isLoginCommand) {
    await next()
    return
  }

  let apiKey = process.env.OPENFORT_API_KEY
  if (!apiKey) {
    // Reload credentials file (may have been written by login during this session)
    const creds = loadEnvFile(CREDENTIALS_PATH)
    apiKey = creds.get('OPENFORT_API_KEY')
    if (apiKey) {
      process.env.OPENFORT_API_KEY = apiKey
      const pk = creds.get('OPENFORT_PUBLISHABLE_KEY')
      if (pk && !process.env.OPENFORT_PUBLISHABLE_KEY) process.env.OPENFORT_PUBLISHABLE_KEY = pk
      const ws = creds.get('OPENFORT_WALLET_SECRET')
      if (ws && !process.env.OPENFORT_WALLET_SECRET) process.env.OPENFORT_WALLET_SECRET = ws
    }
  }
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
  .command(embeddedWallet)
  .command(sponsorship)
  .command(sessions)
  .command(subscriptions)
  .command(transactions)
  .command(users)
  .command(backendWallet)
  .command(message)

export default cli
