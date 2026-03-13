# Openfort CLI

The official CLI for [Openfort](https://openfort.io).

Built for humans, AI agents, and CI/CD pipelines.

 ██████╗ ██████╗ ███████╗███╗   ██╗███████╗ ██████╗ ██████╗ ████████╗
██╔═══██╗██╔══██╗██╔════╝████╗  ██║██╔════╝██╔═══██╗██╔══██╗╚══██╔══╝
██║   ██║██████╔╝█████╗  ██╔██╗ ██║█████╗  ██║   ██║██████╔╝   ██║   
██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║██╔══╝  ██║   ██║██╔══██╗   ██║   
╚██████╔╝██║     ███████╗██║ ╚████║██║     ╚██████╔╝██║  ██║   ██║   
 ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝╚═╝      ╚═════╝ ╚═╝  ╚═╝   ╚═╝   


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
