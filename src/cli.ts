import { Cli, Errors } from 'incur'
import Openfort from '@openfort/openfort-node'
import { varsSchema } from './vars.js'
import { accounts } from './commands/accounts.js'
import { contracts } from './commands/contracts.js'
import { paymasters } from './commands/paymasters.js'
import { policies } from './commands/policies.js'
import { sponsorship } from './commands/sponsorship.js'
import { subscriptions } from './commands/subscriptions.js'
import { transactions } from './commands/transactions.js'
import { users } from './commands/users.js'

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

cli.use(async (c, next) => {
  const apiKey = process.env.OPENFORT_API_KEY
  if (!apiKey) {
    throw new Errors.IncurError({
      code: 'MISSING_API_KEY',
      message: 'OPENFORT_API_KEY environment variable is required.',
      hint: 'Set it via: export OPENFORT_API_KEY=sk_test_...',
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
.command(sponsorship)
  .command(subscriptions)
  .command(transactions)
  .command(users)

export default cli
