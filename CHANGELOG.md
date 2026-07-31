# @openfort/cli

## 0.2.1

### Patch Changes

- [#53](https://github.com/openfort-xyz/cli/pull/53) [`a60ef29`](https://github.com/openfort-xyz/cli/commit/a60ef29ea1a70db967964debf9fb115c6595b0f5) Thanks [@jamalavedra](https://github.com/jamalavedra)! - Update dependencies (@openfort/openfort-node 0.11.0, incur 0.4.26, viem 2.55.10) and refresh pnpm security overrides (raise axios floor to >=1.18.1, add postcss >=8.5.18, drop stale overrides). Declare Node >=22 engine requirement.

  Harden credential handling and login:

  - Write the credentials file with 0600 permissions and the config directory with 0700, via atomic rename
  - Return a masked API key in `login` structured output instead of the raw secret
  - Bind the login callback server to loopback (127.0.0.1) and report port conflicts clearly
  - Report invalid JSON in command flags with the flag name instead of a raw SyntaxError
  - Remove the broken `openfort.src` bin entry, which pointed at an unpublished file

## 0.2.0

### Minor Changes

- [#50](https://github.com/openfort-xyz/cli/pull/50) [`002e623`](https://github.com/openfort-xyz/cli/commit/002e623c45501890f714507e67c547503c9a493d) Thanks [@isardmart](https://github.com/isardmart)! - Add `logs` command to inspect API request, webhook, and triggered subscription logs

## 0.1.16

### Patch Changes

- [#48](https://github.com/openfort-xyz/cli/pull/48) [`03f7ed4`](https://github.com/openfort-xyz/cli/commit/03f7ed4d47bb7c0308bde2306af4318e9d7dc18c) Thanks [@jamalavedra](https://github.com/jamalavedra)! - Update CLI dependencies to the latest compatible versions.

## 0.1.15

### Patch Changes

- [#41](https://github.com/openfort-xyz/cli/pull/41) [`5c7494c`](https://github.com/openfort-xyz/cli/commit/5c7494c72bb0e6cd1dce3956d9ba16a41737a1da) Thanks [@n00m4d](https://github.com/n00m4d)! - Create public key on login command

## 0.1.14

### Patch Changes

- [#38](https://github.com/openfort-xyz/cli/pull/38) [`22c5a5e`](https://github.com/openfort-xyz/cli/commit/22c5a5ef900b4ea8520680d8979f50c996014ca8) Thanks [@jamalavedra](https://github.com/jamalavedra)! - update deps

## 0.1.13

### Patch Changes

- [#35](https://github.com/openfort-xyz/cli/pull/35) [`f04d270`](https://github.com/openfort-xyz/cli/commit/f04d2704effcc502c7c82e8d346b0b721b51ab77) Thanks [@n00m4d](https://github.com/n00m4d)! - Fix saving api pub key to shield

## 0.1.12

### Patch Changes

- [#33](https://github.com/openfort-xyz/cli/pull/33) [`07f7df1`](https://github.com/openfort-xyz/cli/commit/07f7df10ec78865056803c6c2404c52d83aaac0b) Thanks [@n00m4d](https://github.com/n00m4d)! - Get secret api key from fragment

## 0.1.11

### Patch Changes

- [#31](https://github.com/openfort-xyz/cli/pull/31) [`62c60cf`](https://github.com/openfort-xyz/cli/commit/62c60cfa1cb18e9197627d06950fe2aca23ba459) Thanks [@n00m4d](https://github.com/n00m4d)! - Fix terminal hanging after login

## 0.1.10

### Patch Changes

- [#29](https://github.com/openfort-xyz/cli/pull/29) [`0838160`](https://github.com/openfort-xyz/cli/commit/08381608ce2b8338d62167e9c0b2f560524477c4) Thanks [@n00m4d](https://github.com/n00m4d)! - Add skills link

## 0.1.9

### Patch Changes

- [#27](https://github.com/openfort-xyz/cli/pull/27) [`e3fb6ce`](https://github.com/openfort-xyz/cli/commit/e3fb6ce5974b86fcbee5d13bf5a654055d909b22) Thanks [@jamalavedra](https://github.com/jamalavedra)! - update init sdk mcp

## 0.1.8

### Patch Changes

- [#25](https://github.com/openfort-xyz/cli/pull/25) [`c3db2a2`](https://github.com/openfort-xyz/cli/commit/c3db2a21ade2c0af6557023df6fb7b98b130ec6c) Thanks [@jamalavedra](https://github.com/jamalavedra)! - improve types and load of env

## 0.1.7

### Patch Changes

- [#23](https://github.com/openfort-xyz/cli/pull/23) [`e71b1c6`](https://github.com/openfort-xyz/cli/commit/e71b1c6b101aeb27e352b60b922c6d3699bdaeae) Thanks [@jamalavedra](https://github.com/jamalavedra)! - open login url

## 0.1.6

### Patch Changes

- [#21](https://github.com/openfort-xyz/cli/pull/21) [`56f204b`](https://github.com/openfort-xyz/cli/commit/56f204b12ed0494860d283966dce517c676c03cc) Thanks [@jamalavedra](https://github.com/jamalavedra)! - fix pol naming

## 0.1.5

### Patch Changes

- [#18](https://github.com/openfort-xyz/cli/pull/18) [`a1cbb2e`](https://github.com/openfort-xyz/cli/commit/a1cbb2ec248b97f55bcd05392a28717b31275bd3) Thanks [@jamalavedra](https://github.com/jamalavedra)! - improve setup and guide

## 0.1.4

### Patch Changes

- [#14](https://github.com/openfort-xyz/cli/pull/14) [`133e5dd`](https://github.com/openfort-xyz/cli/commit/133e5dd7cfe46922e75071afd16d69b60b4fab77) Thanks [@n00m4d](https://github.com/n00m4d)! - Add hash message command

## 0.1.3

### Patch Changes

- [#12](https://github.com/openfort-xyz/cli/pull/12) [`e407ba1`](https://github.com/openfort-xyz/cli/commit/e407ba1a06d911d67f788c2fc14a52a4f938063c) Thanks [@n00m4d](https://github.com/n00m4d)! - Fix build

## 0.1.2

### Patch Changes

- [#10](https://github.com/openfort-xyz/cli/pull/10) [`a6a1370`](https://github.com/openfort-xyz/cli/commit/a6a1370155ba7ae2e5be11fb02e8a30dc6a4ea03) Thanks [@n00m4d](https://github.com/n00m4d)! - Add author

## 0.1.1

### Patch Changes

- [#8](https://github.com/openfort-xyz/cli/pull/8) [`4790a48`](https://github.com/openfort-xyz/cli/commit/4790a48ee49938729140f09f9818bf2b3c5be344) Thanks [@n00m4d](https://github.com/n00m4d)! - Bump version
