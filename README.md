# Openfort CLI

The official CLI for [Openfort](https://openfort.io).

Built for humans, AI agents, and CI/CD pipelines.

```
██████╗ ██████╗ ███████╗███╗   ██╗███████╗ ██████╗ ██████╗ ████████╗
██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝██╔═══██╗██╔══██╗╚══██╔══╝
██║   ██║██████╔╝█████╗  ██╔██╗ ██║█████╗  ██║   ██║██████╔╝   ██║   
██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██╔══╝  ██║   ██║██╔══██╗   ██║   
╚██████╔╝██║     ███████╗██║ ╚████║██║     ╚██████╔╝██║  ██║   ██║   
 ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝╚═╝      ╚═════╝ ╚═╝  ╚═╝   ╚═╝  
```

## Quick Start

### 1. Install
```bash
npm install -g @openfort/cli
```

### 2. Login
```bash
openfort login
```

### 3. Set up backend wallet signing keys
```bash
openfort backend-wallet setup
```

### 4. Use
```bash
# List all accounts across chains
openfort accounts list

# Create an EVM backend wallet
openfort accounts evm create

# Create a Solana backend wallet
openfort accounts solana create

# List policies
openfort policies list

# Send a transaction
openfort transactions create --account acc_1a2b3c4d --chainId 137 --interactions '[{"to":"0x...","value":"0"}]'

# Estimate gas cost
openfort transactions estimate --account acc_1a2b3c4d --chainId 137 --interactions '[{"to":"0x...","value":"0"}]'
```

## AI Agent Integration

### MCP (Model Context Protocol)

Register the CLI as an MCP server for your AI agent:

```bash
openfort mcp add
```

This registers Openfort tools in Claude Code, Cursor, and Amp. Agents can then call any CLI command as a tool.

### Skills

Install agent skill files for discovery:

```bash
openfort skills add
```

## Environment Variables

| Variable                   | Description                                     |
| -------------------------- | ----------------------------------------------- |
| `OPENFORT_API_KEY`         | Secret API key (`sk_test_...` or `sk_live_...`) |
| `OPENFORT_WALLET_SECRET`   | Wallet encryption secret                        |
| `OPENFORT_PUBLISHABLE_KEY` | Publishable key for client-side ops             |
| `OPENFORT_BASE_URL`        | Custom API base URL                             |

## Commands

| Command           | Description                                                         |
| ----------------- | ------------------------------------------------------------------- |
| `login`           | Log in to Openfort via browser and save your API key                |
| `accounts`        | Manage wallets and accounts (EVM and Solana subcommands)            |
| `contracts`       | Manage smart contracts                                              |
| `paymasters`      | Manage ERC-4337 paymasters                                          |
| `policies`        | Manage rules and conditions for backend wallets and fee sponsorship |
| `sponsorship`     | Manage fee sponsorship strategies linked to policies                |
| `sessions`        | Manage session keys                                                 |
| `subscriptions`   | Manage webhook subscriptions and triggers                           |
| `transactions`    | Manage transaction intents                                          |
| `users`           | Manage authenticated users                                          |
| `backend-wallet`  | Configure backend wallet signing keys                               |
| `embedded-wallet` | Configure embedded wallet (Shield) API keys                         |
| `message`         | Message utilities (e.g. keccak256 hashing)                          |

## Alias

The CLI is also available as `of`:

```bash
of accounts list
```

## Documentation

For full documentation, visit [openfort.io/docs/overview/building-with-cli](https://www.openfort.io/docs/overview/building-with-cli).
