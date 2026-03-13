![Illustration_02](https://github.com/user-attachments/assets/7733bc34-9fa7-4e43-bde0-bbbf5518738c)


<div align="center">
  <h4>
    <a href="https://www.openfort.io/">
      Website
    </a>
    <span> | </span>
    <a href="https://www.openfort.io/docs/overview/building-with-cli">
      Documentation
    </a>
    <span> | </span>
    <a href="https://x.com/openfort_hq">
      X
    </a>
  </h4>
</div>

# Openfort CLI

[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Documentation](https://img.shields.io/badge/docs-openfort.io-blue)](https://www.openfort.io/docs/overview/building-with-cli)
[![Version](https://img.shields.io/npm/v/@openfort/cli.svg)](https://www.npmjs.org/package/@openfort/cli)

**Manage wallets, policies, and transactions from the terminal.** CLI for Openfort's wallet infrastructure.

## Features
- 💼 **Account Management** — create and list smart accounts
- 📜 **Contracts** — register and manage on-chain contracts
- ⚡ **Transactions** — send and estimate transactions
- 🔐 **Session Keys** — create and manage session keys
- 💸 **Gas Sponsorship** — configure policies and sponsorship rules
- 👥 **Users** — manage users and wallet keys
- 🔒 **Shield** — wallet encryption and recovery
- 🔔 **Subscriptions** — set up webhooks and event subscriptions
- 🤖 **AI-friendly** — works as an MCP tool for LLM agents

## Quick Start

### 1. Install
```bash
npm install -g @openfort/cli
```

### 2. Login
```bash
openfort login
```

### 3. Use
```bash
# List accounts
openfort accounts list

# Create a backend wallet
openfort accounts create --chainId 80002

# List policies
openfort policies list

# Send a transaction
openfort transactions create --policy <policy_id> --interactions '[...]'
```

## Environment Variables

| Variable | Description |
|---|---|
| `OPENFORT_API_KEY` | Secret API key (`sk_test_...` or `sk_live_...`) |
| `OPENFORT_WALLET_SECRET` | Wallet encryption secret |
| `OPENFORT_PUBLISHABLE_KEY` | Publishable key for client-side ops |
| `OPENFORT_BASE_URL` | Custom API base URL |

## Commands

| Command | Description |
|---|---|
| `login` | Authenticate with your Openfort API key |
| `accounts` | Create and manage smart accounts |
| `contracts` | Register and manage contracts |
| `paymasters` | Manage paymasters |
| `policies` | Configure gas policies |
| `sponsorship` | Set up gas sponsorship rules |
| `sessions` | Manage session keys |
| `subscriptions` | Set up webhooks and subscriptions |
| `transactions` | Send and estimate transactions |
| `users` | Manage users |
| `wallet-keys` | Manage wallet keys |
| `shield` | Wallet encryption and recovery |

## Documentation

For full documentation, visit [openfort.io/docs/overview/building-with-cli](https://www.openfort.io/docs/overview/building-with-cli).
