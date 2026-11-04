---
"@openfort/cli": patch
---

Depend on `@openfort/openfort-node` ^0.14.0, which moves to zod 4.6.7 and patched axios, follow-redirects and undici, so global installs of the CLI no longer pull the vulnerable versions.
