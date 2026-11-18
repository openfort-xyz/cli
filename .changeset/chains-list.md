---
"@openfort/cli": minor
---

Add `chains list` (MCP tool `chains_list`) to list the chains Openfort supports, with chain type, testnet flag, bundler and EIP-7702 support. It calls the public `GET /v1/chains` endpoint and needs no API key. Filter with `--chainType EVM|SVM` and `--network mainnet|testnet`.
