import { readFileSync } from 'node:fs'
import { Cli, z } from 'incur'
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

cli.command(login)

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
