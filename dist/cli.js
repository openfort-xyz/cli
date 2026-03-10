// src/cli.ts
import { Cli as Cli9, Errors } from "incur";
import Openfort from "@openfort/openfort-node";

// src/vars.ts
import { z } from "incur";
var varsSchema = z.object({
  openfort: z.custom()
});

// src/commands/login.ts
import { randomBytes } from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { createServer } from "http";
import { join } from "path";
import { z as z2 } from "incur";

// src/constants.ts
var API_BASE_URL = process.env.OPENFORT_BASE_URL || "https://api.openfort.xyz";
var AUTH_PAGE_URL = process.env.OPENFORT_AUTH_PAGE_URL || "https://auth.openfort.xyz";
var CLI_CALLBACK_PORT = Number(process.env.OPENFORT_CLI_CALLBACK_PORT) || 8271;

// src/commands/login.ts
function base64url(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function generateState() {
  return base64url(randomBytes(16));
}
function waitForCallback(port, state) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("Login timed out after 5 minutes. Please try again."));
    }, 5 * 60 * 1e3);
    const server = createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);
      if (url.pathname === "/callback") {
        const apiKey = url.searchParams.get("api_key");
        const project = url.searchParams.get("project");
        const returnedState = url.searchParams.get("state");
        const error = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");
        if (error) {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end("<html><body><h1>Login failed</h1><p>You can close this window.</p></body></html>");
          clearTimeout(timeout);
          server.close();
          reject(new Error(errorDescription || error));
          return;
        }
        if (!apiKey || returnedState !== state) {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end("<html><body><h1>Invalid callback</h1><p>Missing API key or state mismatch.</p></body></html>");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html><body><h1>Login successful!</h1><p>You can close this window and return to your terminal.</p></body></html>");
        clearTimeout(timeout);
        server.close();
        resolve({ apiKey, project: project || "unknown" });
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    server.listen(port);
  });
}
function loadEnvFile(envPath) {
  const entries = /* @__PURE__ */ new Map();
  if (!existsSync(envPath)) return entries;
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    entries.set(key, value);
  }
  return entries;
}
function writeEnvKey(envPath, key, value) {
  const entries = loadEnvFile(envPath);
  entries.set(key, value);
  const lines = [];
  for (const [k, v] of entries) {
    lines.push(`${k}=${v}`);
  }
  writeFileSync(envPath, `${lines.join("\n")}
`);
}
var loginConfig = {
  description: "Log in to Openfort via browser and save your API key to .env",
  output: z2.object({
    apiKey: z2.string().describe("The API key saved to .env"),
    project: z2.string().describe("The project name"),
    envPath: z2.string().describe("Path to the .env file")
  }),
  async run(c) {
    const state = generateState();
    const port = CLI_CALLBACK_PORT;
    const redirectUri = `http://localhost:${port}/callback`;
    const authUrl = new URL(`${AUTH_PAGE_URL}/oauth/consent`);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);
    console.log("\nOpen this URL in your browser to log in:\n");
    console.log(`  ${authUrl.toString()}
`);
    console.log("Waiting for authentication...\n");
    const { apiKey, project } = await waitForCallback(port, state);
    const envPath = join(process.cwd(), ".env");
    writeEnvKey(envPath, "OPENFORT_API_KEY", apiKey);
    console.log(`Saved API key for project "${project}" to ${envPath}`);
    return c.ok(
      { apiKey, project, envPath },
      {
        cta: {
          description: "Next steps:",
          commands: [
            { command: "accounts list", description: "List your accounts" },
            { command: "contracts list", description: "List your contracts" },
            { command: "policies list", description: "List your policies" }
          ]
        }
      }
    );
  }
};

// src/commands/accounts.ts
import { Cli, z as z3 } from "incur";
var evm = Cli.create("evm", {
  description: "EVM wallet management.",
  vars: varsSchema
});
evm.command("create", {
  description: "Create a new EVM backend wallet.",
  output: z3.object({
    id: z3.string().describe("Account ID"),
    address: z3.string().describe("Wallet address"),
    custody: z3.string().describe("Custody type")
  }),
  async run(c) {
    const account = await c.var.openfort.accounts.evm.backend.create();
    return c.ok(
      { id: account.id, address: account.address, custody: account.custody },
      {
        cta: {
          description: "Next steps:",
          commands: [
            { command: `accounts evm get ${account.id}`, description: "View this account" },
            { command: "policies create", description: "Create an access policy" }
          ]
        }
      }
    );
  }
});
evm.command("list", {
  description: "List EVM backend wallets.",
  options: z3.object({
    limit: z3.number().optional().describe("Max results"),
    skip: z3.number().optional().describe("Offset")
  }),
  alias: { limit: "l" },
  output: z3.object({
    accounts: z3.array(z3.object({
      id: z3.string(),
      address: z3.string(),
      custody: z3.string()
    })),
    total: z3.number().optional()
  }),
  async run(c) {
    const res = await c.var.openfort.accounts.evm.backend.list({
      limit: c.options.limit,
      skip: c.options.skip
    });
    return c.ok({
      accounts: res.accounts.map((a) => ({
        id: a.id,
        address: a.address,
        custody: a.custody
      })),
      total: res.total
    });
  }
});
evm.command("get", {
  description: "Get an EVM backend wallet by ID or address.",
  args: z3.object({
    id: z3.string().describe("Account ID or address")
  }),
  output: z3.object({
    id: z3.string(),
    address: z3.string(),
    custody: z3.string()
  }),
  async run(c) {
    const a = await c.var.openfort.accounts.evm.backend.get({ id: c.args.id });
    return c.ok({
      id: a.id,
      address: a.address,
      custody: a.custody
    });
  }
});
evm.command("delete", {
  description: "Delete an EVM backend wallet.",
  args: z3.object({
    id: z3.string().describe("Account ID")
  }),
  output: z3.object({
    id: z3.string(),
    deleted: z3.boolean()
  }),
  async run(c) {
    const res = await c.var.openfort.accounts.evm.backend.delete(c.args.id);
    return c.ok({ id: res.id, deleted: res.deleted });
  }
});
var solana = Cli.create("solana", {
  description: "Solana wallet management.",
  vars: varsSchema
});
solana.command("create", {
  description: "Create a new Solana backend wallet.",
  output: z3.object({
    id: z3.string().describe("Account ID"),
    address: z3.string().describe("Wallet address"),
    custody: z3.string().describe("Custody type")
  }),
  async run(c) {
    const account = await c.var.openfort.accounts.solana.backend.create();
    return c.ok(
      { id: account.id, address: account.address, custody: account.custody },
      {
        cta: {
          description: "Next steps:",
          commands: [
            { command: `accounts solana get ${account.id}`, description: "View this account" }
          ]
        }
      }
    );
  }
});
solana.command("list", {
  description: "List Solana backend wallets.",
  options: z3.object({
    limit: z3.number().optional().describe("Max results"),
    skip: z3.number().optional().describe("Offset")
  }),
  alias: { limit: "l" },
  output: z3.object({
    accounts: z3.array(z3.object({
      id: z3.string(),
      address: z3.string(),
      custody: z3.string()
    })),
    total: z3.number().optional()
  }),
  async run(c) {
    const res = await c.var.openfort.accounts.solana.backend.list({
      limit: c.options.limit,
      skip: c.options.skip
    });
    return c.ok({
      accounts: res.accounts.map((a) => ({
        id: a.id,
        address: a.address,
        custody: a.custody
      })),
      total: res.total
    });
  }
});
solana.command("get", {
  description: "Get a Solana backend wallet by ID or address.",
  args: z3.object({
    id: z3.string().describe("Account ID or address")
  }),
  output: z3.object({
    id: z3.string(),
    address: z3.string(),
    custody: z3.string()
  }),
  async run(c) {
    const a = await c.var.openfort.accounts.solana.backend.get({ id: c.args.id });
    return c.ok({
      id: a.id,
      address: a.address,
      custody: a.custody
    });
  }
});
solana.command("delete", {
  description: "Delete a Solana backend wallet.",
  args: z3.object({
    id: z3.string().describe("Account ID")
  }),
  output: z3.object({
    id: z3.string(),
    deleted: z3.boolean()
  }),
  async run(c) {
    const res = await c.var.openfort.accounts.solana.backend.delete(c.args.id);
    return c.ok({ id: res.id, deleted: res.deleted });
  }
});
var accounts = Cli.create("accounts", {
  description: "Manage wallets and accounts.",
  vars: varsSchema
});
accounts.command("list", {
  description: "List all accounts across chains.",
  options: z3.object({
    limit: z3.number().optional().describe("Max results"),
    skip: z3.number().optional().describe("Offset"),
    chainType: z3.enum(["EVM", "SVM"]).optional().describe("Filter by chain type"),
    custody: z3.enum(["Developer", "User"]).optional().describe("Filter by custody")
  }),
  alias: { limit: "l" },
  output: z3.object({
    data: z3.array(z3.object({
      id: z3.string(),
      wallet: z3.string().describe("Wallet ID"),
      accountType: z3.string().describe("Account type"),
      address: z3.string(),
      ownerAddress: z3.string().optional(),
      chainType: z3.string(),
      chainId: z3.number().optional(),
      custody: z3.string(),
      createdAt: z3.number(),
      updatedAt: z3.number()
    })),
    total: z3.number()
  }),
  async run(c) {
    const res = await c.var.openfort.accounts.list({
      limit: c.options.limit,
      skip: c.options.skip,
      chainType: c.options.chainType,
      custody: c.options.custody
    });
    return c.ok({
      data: res.data.map((a) => ({
        id: a.id,
        wallet: a.wallet,
        accountType: a.accountType,
        address: a.address,
        ownerAddress: a.ownerAddress,
        chainType: a.chainType,
        chainId: a.chainId,
        custody: a.custody,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt
      })),
      total: res.total
    });
  }
});
accounts.command(evm);
accounts.command(solana);

// src/commands/contracts.ts
import { Cli as Cli2, z as z4 } from "incur";
var contractItem = z4.object({
  id: z4.string(),
  createdAt: z4.number(),
  name: z4.string().nullable(),
  chainId: z4.number(),
  address: z4.string(),
  deleted: z4.boolean(),
  abi: z4.array(z4.any()),
  publicVerification: z4.boolean()
});
var contracts = Cli2.create("contracts", {
  description: "Manage smart contracts.",
  vars: varsSchema
});
contracts.command("list", {
  description: "List registered contracts.",
  options: z4.object({
    limit: z4.number().optional().describe("Max results"),
    skip: z4.number().optional().describe("Offset")
  }),
  alias: { limit: "l" },
  output: z4.object({
    data: z4.array(contractItem),
    total: z4.number()
  }),
  async run(c) {
    const res = await c.var.openfort.contracts.list({
      limit: c.options.limit,
      skip: c.options.skip
    });
    return c.ok({
      data: res.data.map((ct) => ({
        id: ct.id,
        createdAt: ct.createdAt,
        name: ct.name,
        chainId: ct.chainId,
        address: ct.address,
        deleted: ct.deleted,
        abi: ct.abi,
        publicVerification: ct.publicVerification
      })),
      total: res.total
    });
  }
});
contracts.command("create", {
  description: "Register a smart contract.",
  options: z4.object({
    name: z4.string().describe("Contract name"),
    address: z4.string().describe("Contract address"),
    chainId: z4.number().describe("Chain ID"),
    abi: z4.string().optional().describe("Contract ABI as JSON string")
  }),
  output: contractItem,
  examples: [
    {
      options: { name: "USDC", address: "0xA0b8...", chainId: 137 },
      description: "Register USDC on Polygon"
    }
  ],
  async run(c) {
    const res = await c.var.openfort.contracts.create({
      name: c.options.name,
      address: c.options.address,
      chainId: c.options.chainId,
      abi: c.options.abi ? JSON.parse(c.options.abi) : void 0
    });
    return c.ok({
      id: res.id,
      createdAt: res.createdAt,
      name: res.name,
      chainId: res.chainId,
      address: res.address,
      deleted: res.deleted,
      abi: res.abi,
      publicVerification: res.publicVerification
    });
  }
});
contracts.command("get", {
  description: "Get a contract by ID.",
  args: z4.object({
    id: z4.string().describe("Contract ID (con_...)")
  }),
  output: contractItem,
  async run(c) {
    const ct = await c.var.openfort.contracts.get(c.args.id);
    return c.ok({
      id: ct.id,
      createdAt: ct.createdAt,
      name: ct.name,
      chainId: ct.chainId,
      address: ct.address,
      deleted: ct.deleted,
      abi: ct.abi,
      publicVerification: ct.publicVerification
    });
  }
});
contracts.command("update", {
  description: "Update a contract.",
  args: z4.object({
    id: z4.string().describe("Contract ID (con_...)")
  }),
  options: z4.object({
    name: z4.string().optional().describe("New name"),
    address: z4.string().optional().describe("New address"),
    chainId: z4.number().optional().describe("New chain ID"),
    abi: z4.string().optional().describe("New ABI as JSON string")
  }),
  output: contractItem,
  async run(c) {
    const res = await c.var.openfort.contracts.update(c.args.id, {
      name: c.options.name,
      address: c.options.address,
      chainId: c.options.chainId,
      abi: c.options.abi ? JSON.parse(c.options.abi) : void 0
    });
    return c.ok({
      id: res.id,
      createdAt: res.createdAt,
      name: res.name,
      chainId: res.chainId,
      address: res.address,
      deleted: res.deleted,
      abi: res.abi,
      publicVerification: res.publicVerification
    });
  }
});
contracts.command("delete", {
  description: "Delete a contract.",
  args: z4.object({
    id: z4.string().describe("Contract ID (con_...)")
  }),
  output: z4.object({
    id: z4.string(),
    deleted: z4.boolean()
  }),
  async run(c) {
    const res = await c.var.openfort.contracts.delete(c.args.id);
    return c.ok({ id: res.id, deleted: res.deleted });
  }
});

// src/commands/paymasters.ts
import { Cli as Cli3, z as z5 } from "incur";
var paymasterItem = z5.object({
  id: z5.string(),
  createdAt: z5.number(),
  address: z5.string(),
  url: z5.string().optional(),
  context: z5.record(z5.string(), z5.unknown()).optional()
});
var paymasters = Cli3.create("paymasters", {
  description: "Manage ERC-4337 paymasters.",
  vars: varsSchema
});
paymasters.command("create", {
  description: "Create a paymaster.",
  options: z5.object({
    address: z5.string().describe("Paymaster contract address"),
    name: z5.string().optional().describe("Paymaster name"),
    url: z5.string().optional().describe("Paymaster URL")
  }),
  output: paymasterItem,
  async run(c) {
    const res = await c.var.openfort.paymasters.create({
      address: c.options.address,
      name: c.options.name,
      url: c.options.url
    });
    return c.ok({
      id: res.id,
      createdAt: res.createdAt,
      address: res.address,
      url: res.url,
      context: res.context
    });
  }
});
paymasters.command("get", {
  description: "Get a paymaster by ID.",
  args: z5.object({
    id: z5.string().describe("Paymaster ID (pay_...)")
  }),
  output: paymasterItem,
  async run(c) {
    const p = await c.var.openfort.paymasters.get(c.args.id);
    return c.ok({
      id: p.id,
      createdAt: p.createdAt,
      address: p.address,
      url: p.url,
      context: p.context
    });
  }
});
paymasters.command("update", {
  description: "Update a paymaster.",
  args: z5.object({
    id: z5.string().describe("Paymaster ID (pay_...)")
  }),
  options: z5.object({
    address: z5.string().describe("Paymaster address"),
    name: z5.string().optional().describe("New name"),
    url: z5.string().optional().describe("New URL")
  }),
  output: paymasterItem,
  async run(c) {
    const res = await c.var.openfort.paymasters.update(c.args.id, {
      address: c.options.address,
      name: c.options.name,
      url: c.options.url
    });
    return c.ok({
      id: res.id,
      createdAt: res.createdAt,
      address: res.address,
      url: res.url,
      context: res.context
    });
  }
});
paymasters.command("delete", {
  description: "Delete a paymaster.",
  args: z5.object({
    id: z5.string().describe("Paymaster ID (pay_...)")
  }),
  output: z5.object({
    id: z5.string(),
    deleted: z5.boolean()
  }),
  async run(c) {
    const res = await c.var.openfort.paymasters.delete(c.args.id);
    return c.ok({ id: res.id, deleted: res.deleted });
  }
});

// src/commands/policies.ts
import { Cli as Cli4, z as z6 } from "incur";
var policyScopes = ["project", "account", "transaction"];
var policies = Cli4.create("policies", {
  description: "Manage access-control policies.",
  vars: varsSchema
});
policies.command("list", {
  description: "List policies.",
  options: z6.object({
    limit: z6.number().optional().describe("Max results"),
    skip: z6.number().optional().describe("Offset"),
    scope: z6.enum(policyScopes).optional().describe("Filter by scope"),
    enabled: z6.boolean().optional().describe("Filter by enabled status")
  }),
  alias: { limit: "l" },
  output: z6.object({
    data: z6.array(z6.object({
      id: z6.string(),
      createdAt: z6.number(),
      scope: z6.string(),
      description: z6.string().nullable(),
      accountId: z6.string().nullable(),
      enabled: z6.boolean(),
      priority: z6.number()
    })),
    total: z6.number()
  }),
  async run(c) {
    const scopeFilter = c.options.scope ? [c.options.scope] : void 0;
    const res = await c.var.openfort.policies.list({
      limit: c.options.limit,
      skip: c.options.skip,
      scope: scopeFilter,
      enabled: c.options.enabled
    });
    return c.ok({
      data: res.data.map((p) => ({
        id: p.id,
        createdAt: p.createdAt,
        scope: p.scope,
        description: p.description,
        accountId: p.accountId,
        enabled: p.enabled,
        priority: p.priority
      })),
      total: res.total
    });
  }
});
policies.command("create", {
  description: "Create a policy with criteria-based rules.",
  options: z6.object({
    scope: z6.enum(policyScopes).describe("Policy scope"),
    description: z6.string().optional().describe("Policy description"),
    priority: z6.number().optional().describe("Priority (higher = evaluated first)"),
    rules: z6.string().describe("Rules as JSON string")
  }),
  output: z6.object({
    id: z6.string(),
    createdAt: z6.number(),
    scope: z6.string(),
    description: z6.string().nullable(),
    enabled: z6.boolean(),
    priority: z6.number()
  }),
  examples: [
    {
      options: {
        scope: "project",
        rules: '[{"action":"accept","operation":"sponsorEvmTransaction","criteria":[{"type":"evmNetwork","operator":"in","chainIds":[137]}]}]'
      },
      description: "Create a policy to sponsor transactions on Polygon"
    }
  ],
  async run(c) {
    const rules = JSON.parse(c.options.rules);
    const scope = c.options.scope;
    const res = await c.var.openfort.policies.create({
      scope,
      description: c.options.description,
      priority: c.options.priority,
      rules
    });
    return c.ok(
      {
        id: res.id,
        createdAt: res.createdAt,
        scope: res.scope,
        description: res.description,
        enabled: res.enabled,
        priority: res.priority
      },
      {
        cta: {
          description: "Next steps:",
          commands: [
            { command: `policies get ${res.id}`, description: "View this policy" },
            { command: `sponsorship create --policyId ${res.id}`, description: "Create a fee sponsorship" }
          ]
        }
      }
    );
  }
});
policies.command("get", {
  description: "Get a policy by ID.",
  args: z6.object({
    id: z6.string().describe("Policy ID (ply_...)")
  }),
  output: z6.object({
    id: z6.string(),
    createdAt: z6.number(),
    scope: z6.string(),
    description: z6.string().nullable(),
    accountId: z6.string().nullable(),
    enabled: z6.boolean(),
    priority: z6.number(),
    rules: z6.array(z6.any())
  }),
  async run(c) {
    const p = await c.var.openfort.policies.get(c.args.id);
    return c.ok({
      id: p.id,
      createdAt: p.createdAt,
      scope: p.scope,
      description: p.description,
      accountId: p.accountId,
      enabled: p.enabled,
      priority: p.priority,
      rules: p.rules
    });
  }
});
policies.command("update", {
  description: "Update a policy.",
  args: z6.object({
    id: z6.string().describe("Policy ID (ply_...)")
  }),
  options: z6.object({
    description: z6.string().optional().describe("New description"),
    enabled: z6.boolean().optional().describe("Enable or disable"),
    priority: z6.number().optional().describe("New priority"),
    rules: z6.string().optional().describe("New rules as JSON string")
  }),
  output: z6.object({
    id: z6.string(),
    createdAt: z6.number(),
    scope: z6.string(),
    description: z6.string().nullable(),
    enabled: z6.boolean(),
    priority: z6.number()
  }),
  async run(c) {
    const res = await c.var.openfort.policies.update(c.args.id, {
      description: c.options.description,
      enabled: c.options.enabled,
      priority: c.options.priority,
      rules: c.options.rules ? JSON.parse(c.options.rules) : void 0
    });
    return c.ok({
      id: res.id,
      createdAt: res.createdAt,
      scope: res.scope,
      description: res.description,
      enabled: res.enabled,
      priority: res.priority
    });
  }
});
policies.command("delete", {
  description: "Delete a policy.",
  args: z6.object({
    id: z6.string().describe("Policy ID (ply_...)")
  }),
  output: z6.object({
    id: z6.string(),
    deleted: z6.boolean()
  }),
  async run(c) {
    const res = await c.var.openfort.policies.delete(c.args.id);
    return c.ok({ id: res.id, deleted: res.deleted });
  }
});
policies.command("evaluate", {
  description: "Pre-flight check if an operation would be allowed.",
  options: z6.object({
    operation: z6.string().describe("Operation to evaluate (e.g. signEvmTransaction)"),
    accountId: z6.string().optional().describe("Account ID")
  }),
  output: z6.object({
    allowed: z6.boolean(),
    reason: z6.string(),
    operation: z6.string(),
    accountId: z6.string().optional(),
    matchedPolicyId: z6.string().optional(),
    matchedRuleId: z6.string().optional()
  }),
  async run(c) {
    const res = await c.var.openfort.policies.evaluate({
      operation: c.options.operation,
      accountId: c.options.accountId
    });
    return c.ok({
      allowed: res.allowed,
      reason: res.reason,
      operation: res.operation,
      accountId: res.accountId,
      matchedPolicyId: res.matchedPolicyId,
      matchedRuleId: res.matchedRuleId
    });
  }
});

// src/commands/sponsorship.ts
import { Cli as Cli5, z as z7 } from "incur";
var sponsorSchemas = ["pay_for_user", "charge_custom_tokens", "fixed_rate"];
var sponsorshipItem = z7.object({
  id: z7.string(),
  createdAt: z7.number(),
  name: z7.string().nullable(),
  chainId: z7.number().nullable(),
  enabled: z7.boolean(),
  strategy: z7.object({
    sponsorSchema: z7.string(),
    tokenContract: z7.string().optional(),
    tokenContractAmount: z7.string().optional(),
    dynamicExchangeRate: z7.boolean().optional()
  }),
  paymasterId: z7.string().nullable(),
  policyId: z7.string().nullable()
});
var sponsorship = Cli5.create("sponsorship", {
  description: "Manage fee sponsorships for gas costs.",
  vars: varsSchema
});
sponsorship.command("list", {
  description: "List fee sponsorships.",
  options: z7.object({
    limit: z7.number().optional().describe("Max results"),
    skip: z7.number().optional().describe("Offset"),
    enabled: z7.boolean().optional().describe("Filter by enabled status")
  }),
  alias: { limit: "l" },
  output: z7.object({
    data: z7.array(sponsorshipItem),
    total: z7.number()
  }),
  async run(c) {
    const res = await c.var.openfort.feeSponsorship.list({
      limit: c.options.limit,
      skip: c.options.skip,
      enabled: c.options.enabled
    });
    return c.ok({
      data: res.data.map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        name: s.name,
        chainId: s.chainId,
        enabled: s.enabled,
        strategy: s.strategy,
        paymasterId: s.paymasterId,
        policyId: s.policyId
      })),
      total: res.total
    });
  }
});
sponsorship.command("create", {
  description: "Create a fee sponsorship linked to a policy.",
  options: z7.object({
    policyId: z7.string().describe("Policy ID to link (ply_...)"),
    name: z7.string().optional().describe("Sponsorship name"),
    strategy: z7.enum(sponsorSchemas).default("pay_for_user").describe("Sponsorship strategy"),
    chainId: z7.number().optional().describe("Chain ID")
  }),
  output: sponsorshipItem,
  examples: [
    {
      options: { policyId: "ply_...", strategy: "pay_for_user", name: "Polygon Gas" },
      description: "Create a pay-for-user sponsorship"
    }
  ],
  async run(c) {
    const strategy = { sponsorSchema: c.options.strategy };
    const res = await c.var.openfort.feeSponsorship.create({
      policyId: c.options.policyId,
      name: c.options.name,
      strategy,
      chainId: c.options.chainId
    });
    return c.ok(
      {
        id: res.id,
        createdAt: res.createdAt,
        name: res.name,
        chainId: res.chainId,
        enabled: res.enabled,
        strategy: res.strategy,
        paymasterId: res.paymasterId,
        policyId: res.policyId
      },
      {
        cta: {
          description: "Next steps:",
          commands: [
            { command: `sponsorship get ${res.id}`, description: "View this sponsorship" },
            { command: "transactions create", description: "Create a sponsored transaction" }
          ]
        }
      }
    );
  }
});
sponsorship.command("get", {
  description: "Get a fee sponsorship by ID.",
  args: z7.object({
    id: z7.string().describe("Fee sponsorship ID")
  }),
  output: sponsorshipItem,
  async run(c) {
    const s = await c.var.openfort.feeSponsorship.get(c.args.id);
    return c.ok({
      id: s.id,
      createdAt: s.createdAt,
      name: s.name,
      chainId: s.chainId,
      enabled: s.enabled,
      strategy: s.strategy,
      paymasterId: s.paymasterId,
      policyId: s.policyId
    });
  }
});
sponsorship.command("update", {
  description: "Update a fee sponsorship.",
  args: z7.object({
    id: z7.string().describe("Fee sponsorship ID")
  }),
  options: z7.object({
    name: z7.string().optional().describe("New name"),
    strategy: z7.enum(sponsorSchemas).optional().describe("New strategy"),
    policyId: z7.string().optional().describe("New policy ID")
  }),
  output: sponsorshipItem,
  async run(c) {
    const strategy = c.options.strategy ? { sponsorSchema: c.options.strategy } : void 0;
    const res = await c.var.openfort.feeSponsorship.update(c.args.id, {
      name: c.options.name,
      strategy,
      policyId: c.options.policyId
    });
    return c.ok({
      id: res.id,
      createdAt: res.createdAt,
      name: res.name,
      chainId: res.chainId,
      enabled: res.enabled,
      strategy: res.strategy,
      paymasterId: res.paymasterId,
      policyId: res.policyId
    });
  }
});
sponsorship.command("enable", {
  description: "Enable a fee sponsorship.",
  args: z7.object({
    id: z7.string().describe("Fee sponsorship ID")
  }),
  output: sponsorshipItem,
  async run(c) {
    const res = await c.var.openfort.feeSponsorship.enable(c.args.id);
    return c.ok({
      id: res.id,
      createdAt: res.createdAt,
      name: res.name,
      chainId: res.chainId,
      enabled: res.enabled,
      strategy: res.strategy,
      paymasterId: res.paymasterId,
      policyId: res.policyId
    });
  }
});
sponsorship.command("disable", {
  description: "Disable a fee sponsorship.",
  args: z7.object({
    id: z7.string().describe("Fee sponsorship ID")
  }),
  output: sponsorshipItem,
  async run(c) {
    const res = await c.var.openfort.feeSponsorship.disable(c.args.id);
    return c.ok({
      id: res.id,
      createdAt: res.createdAt,
      name: res.name,
      chainId: res.chainId,
      enabled: res.enabled,
      strategy: res.strategy,
      paymasterId: res.paymasterId,
      policyId: res.policyId
    });
  }
});
sponsorship.command("delete", {
  description: "Delete a fee sponsorship.",
  args: z7.object({
    id: z7.string().describe("Fee sponsorship ID")
  }),
  output: z7.object({
    id: z7.string(),
    deleted: z7.boolean()
  }),
  async run(c) {
    const res = await c.var.openfort.feeSponsorship.delete(c.args.id);
    return c.ok({ id: res.id, deleted: res.deleted });
  }
});

// src/commands/subscriptions.ts
import { Cli as Cli6, z as z8 } from "incur";
var apiTopics = [
  "transaction_intent.broadcast",
  "transaction_intent.successful",
  "transaction_intent.cancelled",
  "transaction_intent.failed",
  "balance.project",
  "balance.contract",
  "balance.dev_account",
  "test",
  "user.created",
  "user.updated",
  "user.deleted",
  "account.created"
];
var triggerItem = z8.object({
  id: z8.string(),
  createdAt: z8.number(),
  target: z8.string(),
  type: z8.string(),
  subscription: z8.string(),
  updatedAt: z8.number().optional()
});
var subscriptionItem = z8.object({
  id: z8.string(),
  createdAt: z8.number(),
  topic: z8.string(),
  triggers: z8.array(triggerItem),
  updatedAt: z8.number().optional()
});
var subscriptions = Cli6.create("subscriptions", {
  description: "Manage webhook subscriptions.",
  vars: varsSchema
});
subscriptions.command("list", {
  description: "List webhook subscriptions.",
  output: z8.object({
    data: z8.array(subscriptionItem),
    total: z8.number()
  }),
  async run(c) {
    const res = await c.var.openfort.subscriptions.list();
    return c.ok({
      data: res.data.map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        topic: s.topic,
        triggers: s.triggers,
        updatedAt: s.updatedAt
      })),
      total: res.total
    });
  }
});
subscriptions.command("create", {
  description: "Create a webhook subscription.",
  options: z8.object({
    topic: z8.enum(apiTopics).describe("Event topic"),
    triggers: z8.string().describe('Triggers as JSON: [{"type":"...","url":"..."}]')
  }),
  output: subscriptionItem,
  async run(c) {
    const triggers = JSON.parse(c.options.triggers);
    const res = await c.var.openfort.subscriptions.create({
      topic: c.options.topic,
      triggers
    });
    return c.ok({
      id: res.id,
      createdAt: res.createdAt,
      topic: res.topic,
      triggers: res.triggers,
      updatedAt: res.updatedAt
    });
  }
});
subscriptions.command("get", {
  description: "Get a subscription by ID.",
  args: z8.object({
    id: z8.string().describe("Subscription ID (sub_...)")
  }),
  output: subscriptionItem,
  async run(c) {
    const s = await c.var.openfort.subscriptions.get(c.args.id);
    return c.ok({
      id: s.id,
      createdAt: s.createdAt,
      topic: s.topic,
      triggers: s.triggers,
      updatedAt: s.updatedAt
    });
  }
});
subscriptions.command("delete", {
  description: "Delete a subscription.",
  args: z8.object({
    id: z8.string().describe("Subscription ID (sub_...)")
  }),
  output: z8.object({
    id: z8.string(),
    deleted: z8.boolean()
  }),
  async run(c) {
    const res = await c.var.openfort.subscriptions.delete(c.args.id);
    return c.ok({ id: res.id, deleted: res.deleted });
  }
});

// src/commands/transactions.ts
import { Cli as Cli7, z as z9 } from "incur";
var transactionIntentItem = z9.object({
  id: z9.string(),
  createdAt: z9.number(),
  updatedAt: z9.number(),
  chainId: z9.number(),
  abstractionType: z9.string().describe("e.g. accountAbstractionV6, standard"),
  userOperationHash: z9.string().optional(),
  response: z9.object({
    createdAt: z9.number(),
    blockNumber: z9.number().optional(),
    transactionHash: z9.string().optional(),
    gasUsed: z9.string().optional(),
    gasFee: z9.string().optional(),
    status: z9.number().optional(),
    to: z9.string().optional(),
    error: z9.any().optional()
  }).optional(),
  interactions: z9.array(z9.object({
    to: z9.string().optional(),
    data: z9.string().optional(),
    value: z9.string().optional()
  })).optional(),
  nextAction: z9.object({
    type: z9.string(),
    payload: z9.any().optional()
  }).optional()
});
var transactions = Cli7.create("transactions", {
  description: "Manage transaction intents.",
  vars: varsSchema
});
transactions.command("list", {
  description: "List transaction intents.",
  options: z9.object({
    limit: z9.number().optional().describe("Max results"),
    skip: z9.number().optional().describe("Offset")
  }),
  alias: { limit: "l" },
  output: z9.object({
    data: z9.array(z9.object({
      id: z9.string(),
      createdAt: z9.number(),
      updatedAt: z9.number(),
      chainId: z9.number(),
      abstractionType: z9.string()
    })),
    total: z9.number()
  }),
  async run(c) {
    const res = await c.var.openfort.transactionIntents.list({
      limit: c.options.limit,
      skip: c.options.skip
    });
    return c.ok({
      data: res.data.map((t) => ({
        id: t.id,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        chainId: t.chainId,
        abstractionType: t.abstractionType
      })),
      total: res.total
    });
  }
});
transactions.command("create", {
  description: "Create a transaction intent.",
  options: z9.object({
    account: z9.string().describe("Account ID (acc_...)"),
    chainId: z9.number().describe("Chain ID"),
    interactions: z9.string().describe('Interactions as JSON: [{"to":"0x...","data":"0x...","value":"0"}]'),
    policy: z9.string().optional().describe("Policy ID for gas sponsorship")
  }),
  output: transactionIntentItem,
  examples: [
    {
      options: {
        account: "acc_...",
        chainId: 137,
        interactions: '[{"to":"0x1234...","data":"0x","value":"0"}]'
      },
      description: "Create a transaction on Polygon"
    }
  ],
  async run(c) {
    const interactions = JSON.parse(c.options.interactions);
    const res = await c.var.openfort.transactionIntents.create({
      account: c.options.account,
      chainId: c.options.chainId,
      interactions,
      policy: c.options.policy
    });
    return c.ok(
      {
        id: res.id,
        createdAt: res.createdAt,
        updatedAt: res.updatedAt,
        chainId: res.chainId,
        abstractionType: res.abstractionType,
        userOperationHash: res.userOperationHash,
        response: res.response,
        interactions: res.interactions,
        nextAction: res.nextAction
      },
      {
        cta: {
          description: "Next steps:",
          commands: [
            { command: `transactions get ${res.id}`, description: "Check transaction status" }
          ]
        }
      }
    );
  }
});
transactions.command("get", {
  description: "Get a transaction intent by ID.",
  args: z9.object({
    id: z9.string().describe("Transaction intent ID (tin_...)")
  }),
  output: transactionIntentItem,
  async run(c) {
    const t = await c.var.openfort.transactionIntents.get(c.args.id);
    return c.ok({
      id: t.id,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      chainId: t.chainId,
      abstractionType: t.abstractionType,
      userOperationHash: t.userOperationHash,
      response: t.response,
      interactions: t.interactions,
      nextAction: t.nextAction
    });
  }
});
transactions.command("sign", {
  description: "Sign and broadcast a transaction intent.",
  args: z9.object({
    id: z9.string().describe("Transaction intent ID (tin_...)")
  }),
  options: z9.object({
    signature: z9.string().describe("Hex signature"),
    optimistic: z9.boolean().optional().describe("Return before on-chain confirmation")
  }),
  output: transactionIntentItem,
  async run(c) {
    const res = await c.var.openfort.transactionIntents.signature(c.args.id, {
      signature: c.options.signature,
      optimistic: c.options.optimistic
    });
    return c.ok({
      id: res.id,
      createdAt: res.createdAt,
      updatedAt: res.updatedAt,
      chainId: res.chainId,
      abstractionType: res.abstractionType,
      userOperationHash: res.userOperationHash,
      response: res.response,
      interactions: res.interactions,
      nextAction: res.nextAction
    });
  }
});
transactions.command("estimate", {
  description: "Estimate gas cost for a transaction.",
  options: z9.object({
    account: z9.string().describe("Account ID (acc_...)"),
    chainId: z9.number().describe("Chain ID"),
    interactions: z9.string().describe("Interactions as JSON"),
    policy: z9.string().optional().describe("Policy ID for gas sponsorship")
  }),
  output: z9.object({
    estimatedTXGas: z9.string(),
    estimatedTXGasFee: z9.string(),
    estimatedTXGasFeeUSD: z9.string(),
    estimatedTXGasFeeToken: z9.string().optional(),
    gasPrice: z9.string()
  }),
  async run(c) {
    const interactions = JSON.parse(c.options.interactions);
    const res = await c.var.openfort.transactionIntents.estimateCost({
      account: c.options.account,
      chainId: c.options.chainId,
      interactions,
      policy: c.options.policy
    });
    return c.ok({
      estimatedTXGas: res.estimatedTXGas,
      estimatedTXGasFee: res.estimatedTXGasFee,
      estimatedTXGasFeeUSD: res.estimatedTXGasFeeUSD,
      estimatedTXGasFeeToken: res.estimatedTXGasFeeToken,
      gasPrice: res.gasPrice
    });
  }
});

// src/commands/users.ts
import { Cli as Cli8, z as z10 } from "incur";
var userItem = z10.object({
  id: z10.string(),
  createdAt: z10.number(),
  name: z10.string(),
  email: z10.string().nullable(),
  emailVerified: z10.boolean(),
  phoneNumber: z10.string().nullable(),
  phoneNumberVerified: z10.boolean(),
  isAnonymous: z10.boolean().optional(),
  linkedAccounts: z10.array(z10.object({
    provider: z10.string(),
    createdAt: z10.number(),
    updatedAt: z10.number(),
    accountId: z10.string().optional(),
    chainType: z10.string().optional(),
    connectorType: z10.string().optional(),
    walletClientType: z10.string().optional()
  }))
});
var users = Cli8.create("users", {
  description: "Manage authenticated users.",
  vars: varsSchema
});
users.command("list", {
  description: "List users.",
  options: z10.object({
    limit: z10.number().optional().describe("Max results"),
    skip: z10.number().optional().describe("Offset"),
    email: z10.string().optional().describe("Filter by email"),
    name: z10.string().optional().describe("Filter by name")
  }),
  alias: { limit: "l" },
  output: z10.object({
    data: z10.array(userItem),
    total: z10.number()
  }),
  async run(c) {
    const res = await c.var.openfort.iam.users.list({
      limit: c.options.limit,
      skip: c.options.skip,
      email: c.options.email,
      name: c.options.name
    });
    return c.ok({
      data: res.data.map((u) => ({
        id: u.id,
        createdAt: u.createdAt,
        name: u.name,
        email: u.email,
        emailVerified: u.emailVerified,
        phoneNumber: u.phoneNumber,
        phoneNumberVerified: u.phoneNumberVerified,
        isAnonymous: u.isAnonymous,
        linkedAccounts: u.linkedAccounts
      })),
      total: res.total
    });
  }
});
users.command("get", {
  description: "Get a user by ID.",
  args: z10.object({
    id: z10.string().describe("User ID (usr_...)")
  }),
  output: userItem,
  async run(c) {
    const u = await c.var.openfort.iam.users.get(c.args.id);
    return c.ok({
      id: u.id,
      createdAt: u.createdAt,
      name: u.name,
      email: u.email,
      emailVerified: u.emailVerified,
      phoneNumber: u.phoneNumber,
      phoneNumberVerified: u.phoneNumberVerified,
      isAnonymous: u.isAnonymous,
      linkedAccounts: u.linkedAccounts
    });
  }
});
users.command("delete", {
  description: "Delete a user.",
  args: z10.object({
    id: z10.string().describe("User ID (usr_...)")
  }),
  output: z10.object({
    id: z10.string(),
    deleted: z10.boolean()
  }),
  async run(c) {
    const res = await c.var.openfort.iam.users.delete(c.args.id);
    return c.ok({ id: res.id, deleted: res.deleted });
  }
});

// src/cli.ts
var cli = Cli9.create("openfort", {
  version: "0.1.0",
  description: "Openfort CLI \u2014 manage wallets, policies, and transactions.",
  vars: varsSchema,
  sync: {
    suggestions: [
      "create an EVM backend wallet",
      "list all accounts",
      "create a gas sponsorship policy",
      "list users",
      "estimate transaction gas cost"
    ]
  }
});
cli.command("login", loginConfig);
cli.use(async (c, next) => {
  const isLoginCommand = process.argv.slice(2).some((arg) => arg === "login");
  if (isLoginCommand) {
    await next();
    return;
  }
  const apiKey = process.env.OPENFORT_API_KEY;
  if (!apiKey) {
    throw new Errors.IncurError({
      code: "MISSING_API_KEY",
      message: "OPENFORT_API_KEY environment variable is required.",
      hint: "Run: openfort login"
    });
  }
  c.set("openfort", new Openfort(apiKey, {
    walletSecret: process.env.OPENFORT_WALLET_SECRET,
    publishableKey: process.env.OPENFORT_PUBLISHABLE_KEY,
    basePath: process.env.OPENFORT_BASE_URL
  }));
  await next();
});
cli.command(accounts).command(contracts).command(paymasters).command(policies).command(sponsorship).command(subscriptions).command(transactions).command(users);
var cli_default = cli;
export {
  cli_default as default
};
