declare module 'incur' {
  interface Register {
    commands: {
      'accounts evm create': { args: {}; options: {} }
      'accounts evm delete': { args: { id: string }; options: {} }
      'accounts evm export': { args: { id: string }; options: {} }
      'accounts evm get': { args: { id: string }; options: {} }
      'accounts evm import': { args: {}; options: { privateKey: string } }
      'accounts evm list': { args: {}; options: { limit: number; skip: number } }
      'accounts evm list-delegated': { args: {}; options: { limit: number; skip: number } }
      'accounts evm list-smart': { args: {}; options: { limit: number; skip: number } }
      'accounts evm send-transaction': { args: { id: string }; options: { chainId: number; interactions: string; policy: string } }
      'accounts evm sign': { args: { id: string }; options: { data: string } }
      'accounts evm update': { args: { id: string }; options: { chainId: number; implementationType: string } }
      'accounts list': { args: {}; options: { limit: number; skip: number; chainType: "EVM" | "SVM"; custody: "Developer" | "User" } }
      'accounts solana create': { args: {}; options: {} }
      'accounts solana delete': { args: { id: string }; options: {} }
      'accounts solana export': { args: { id: string }; options: {} }
      'accounts solana get': { args: { id: string }; options: {} }
      'accounts solana import': { args: {}; options: { privateKey: string } }
      'accounts solana list': { args: {}; options: { limit: number; skip: number } }
      'accounts solana sign': { args: { id: string }; options: { data: string } }
      'accounts solana transfer': { args: { id: string }; options: { to: string; amount: string; token: string; cluster: "devnet" | "mainnet-beta" } }
      'backend-wallet revoke': { args: {}; options: {} }
      'backend-wallet rotate': { args: {}; options: {} }
      'backend-wallet setup': { args: {}; options: {} }
      'contracts create': { args: {}; options: { name: string; address: string; chainId: number; abi: string } }
      'contracts delete': { args: { id: string }; options: {} }
      'contracts get': { args: { id: string }; options: {} }
      'contracts list': { args: {}; options: { limit: number; skip: number } }
      'contracts update': { args: { id: string }; options: { name: string; address: string; chainId: number; abi: string } }
      'embedded-wallet setup': { args: {}; options: { project: string } }
      'login _root': { args: {}; options: {} }
      'message hash': { args: { message: string }; options: {} }
      'paymasters create': { args: {}; options: { address: string; name: string; url: string } }
      'paymasters delete': { args: { id: string }; options: {} }
      'paymasters get': { args: { id: string }; options: {} }
      'paymasters update': { args: { id: string }; options: { address: string; name: string; url: string } }
      'policies create': { args: {}; options: { scope: "project" | "account" | "transaction"; description: string; priority: number; rules: string } }
      'policies delete': { args: { id: string }; options: {} }
      'policies evaluate': { args: {}; options: { operation: string; accountId: string } }
      'policies get': { args: { id: string }; options: {} }
      'policies list': { args: {}; options: { limit: number; skip: number; scope: "project" | "account" | "transaction"; enabled: boolean } }
      'policies update': { args: { id: string }; options: { description: string; enabled: boolean; priority: number; rules: string } }
      'sessions create': { args: {}; options: { address: string; chainId: number; validAfter: number; validUntil: number; player: string; account: string; limit: number; policy: string; whitelist: string } }
      'sessions get': { args: { id: string }; options: {} }
      'sessions list': { args: {}; options: { player: string; limit: number; skip: number } }
      'sessions revoke': { args: {}; options: { address: string; chainId: number; player: string; policy: string } }
      'sessions sign': { args: { id: string }; options: { signature: string; optimistic: boolean } }
      'sponsorship create': { args: {}; options: { policyId: string; name: string; strategy: "pay_for_user" | "charge_custom_tokens" | "fixed_rate"; chainId: number } }
      'sponsorship delete': { args: { id: string }; options: {} }
      'sponsorship disable': { args: { id: string }; options: {} }
      'sponsorship enable': { args: { id: string }; options: {} }
      'sponsorship get': { args: { id: string }; options: {} }
      'sponsorship list': { args: {}; options: { limit: number; skip: number; enabled: boolean } }
      'sponsorship update': { args: { id: string }; options: { name: string; strategy: "pay_for_user" | "charge_custom_tokens" | "fixed_rate"; policyId: string } }
      'subscriptions create': { args: {}; options: { topic: "transaction_intent.broadcast" | "transaction_intent.successful" | "transaction_intent.cancelled" | "transaction_intent.failed" | "balance.project" | "balance.contract" | "balance.dev_account" | "test" | "user.created" | "user.updated" | "user.deleted" | "account.created"; triggers: string } }
      'subscriptions delete': { args: { id: string }; options: {} }
      'subscriptions get': { args: { id: string }; options: {} }
      'subscriptions list': { args: {}; options: {} }
      'subscriptions triggers create': { args: { subscriptionId: string }; options: { target: string; type: "webhook" | "email" } }
      'subscriptions triggers delete': { args: { subscriptionId: string; triggerId: string }; options: {} }
      'subscriptions triggers get': { args: { subscriptionId: string; triggerId: string }; options: {} }
      'subscriptions triggers list': { args: { subscriptionId: string }; options: {} }
      'transactions create': { args: {}; options: { account: string; chainId: number; interactions: string; policy: string; signedAuthorization: string } }
      'transactions estimate': { args: {}; options: { account: string; chainId: number; interactions: string; policy: string } }
      'transactions get': { args: { id: string }; options: {} }
      'transactions list': { args: {}; options: { limit: number; skip: number } }
      'transactions sign': { args: { id: string }; options: { signature: string; optimistic: boolean } }
      'users delete': { args: { id: string }; options: {} }
      'users get': { args: { id: string }; options: {} }
      'users list': { args: {}; options: { limit: number; skip: number; email: string; name: string } }
    }
  }
}
