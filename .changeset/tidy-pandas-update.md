---
"@openfort/cli": patch
---

Update dependencies (@openfort/openfort-node 0.11.0, incur 0.4.26, viem 2.55.10) and refresh pnpm security overrides (raise axios floor to >=1.18.1, add postcss >=8.5.18, drop stale overrides). Declare Node >=22 engine requirement.

Harden credential handling and login:
- Write the credentials file with 0600 permissions and the config directory with 0700, via atomic rename
- Return a masked API key in `login` structured output instead of the raw secret
- Bind the login callback server to loopback (127.0.0.1) and report port conflicts clearly
- Report invalid JSON in command flags with the flag name instead of a raw SyntaxError
- Remove the broken `openfort.src` bin entry, which pointed at an unpublished file
