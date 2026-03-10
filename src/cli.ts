import { Cli, Errors } from 'incur'
import Openfort from '@openfort/openfort-node'
import { varsSchema } from './vars.js'
import { loginConfig } from './commands/login.js'
import { accounts } from './commands/accounts.js'
import { contracts } from './commands/contracts.js'
import { paymasters } from './commands/paymasters.js'
import { policies } from './commands/policies.js'
import { sponsorship } from './commands/sponsorship.js'
import { subscriptions } from './commands/subscriptions.js'
import { transactions } from './commands/transactions.js'
import { shield } from './commands/shield.js'
import { users } from './commands/users.js'
import { walletKeys } from './commands/wallet-keys.js'

const cli = Cli.create('openfort', {
  version: '0.1.0',
  description: 'Openfort CLI — manage wallets, policies, and transactions.',
  vars: varsSchema,
  sync: {
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
    basePath: process.env.OPENFORT_BASE_URL,
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
  .command(subscriptions)
  .command(transactions)
  .command(users)
  .command(walletKeys)

export default cli
