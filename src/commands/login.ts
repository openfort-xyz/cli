import { randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import open from 'open'
import { Cli, z } from 'incur'
import { AUTH_PAGE_URL, CLI_CALLBACK_PORT } from '../constants.js'
import { CREDENTIALS_PATH, ensureConfigDir } from '../config.js'
import { writeEnvKey } from '../env.js'

function base64url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function generateState(): string {
  return base64url(randomBytes(16))
}

function callbackPage(title: string, description: string, variant: 'success' | 'error' = 'success', extraHtml = ''): string {
  const iconColor = variant === 'success' ? 'hsl(142 71% 45%)' : 'hsl(0 84% 60%)'
  const icon =
    variant === 'success'
      ? `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
      : `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="${iconColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Openfort CLI</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --background: hsl(0 0% 100%);
      --foreground: hsl(20 14.3% 4.1%);
      --card: hsl(0 0% 100%);
      --card-foreground: hsl(20 14.3% 4.1%);
      --border: hsl(20 5.9% 90%);
      --muted-foreground: hsl(25 5.3% 44.7%);
      --radius: 0.3rem;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --background: hsl(20 14.3% 4.1%);
        --foreground: hsl(60 9.1% 97.8%);
        --card: hsl(20 14.3% 4.1%);
        --card-foreground: hsl(60 9.1% 97.8%);
        --border: hsl(12 6.5% 15.1%);
        --muted-foreground: hsl(24 5.4% 63.9%);
      }
    }
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: var(--background);
      color: var(--foreground);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1rem;
    }
    .card {
      background-color: var(--card);
      color: var(--card-foreground);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      width: 100%;
      max-width: 33rem;
      box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
    }
    .card-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 1.5rem;
      text-align: center;
    }
    .card-icon { margin-bottom: 0.5rem; }
    .card-title {
      font-size: 1.5rem;
      font-weight: 600;
      line-height: 1.2;
      letter-spacing: -0.025em;
    }
    .card-description {
      font-size: 0.875rem;
      color: var(--muted-foreground);
      line-height: 1.5;
    }
    .card-extra {
      padding: 0 1.5rem 1.5rem;
      border-top: 1px solid var(--border);
      margin-top: 0;
    }
    .card-extra-title {
      font-size: 0.875rem;
      font-weight: 500;
      margin-top: 1rem;
      margin-bottom: 0.5rem;
    }
    .code-block {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background-color: var(--border);
      border-radius: var(--radius);
      padding: 0.5rem 0.75rem;
      font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      font-size: 0.75rem;
      line-height: 1.5;
      overflow-x: auto;
    }
    .code-block code {
      flex: 1;
      word-break: break-all;
    }
    .code-block button {
      flex-shrink: 0;
      background: none;
      border: none;
      color: var(--muted-foreground);
      cursor: pointer;
      padding: 0.25rem;
      display: flex;
      align-items: center;
    }
    .code-block button:hover {
      color: var(--foreground);
    }
    .card-extra-link {
      display: inline-block;
      margin-top: 0.75rem;
      font-size: 0.8rem;
      color: var(--muted-foreground);
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .card-extra-link:hover {
      color: var(--foreground);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="card-header">
      <div class="card-icon">${icon}</div>
      <h1 class="card-title">${title}</h1>
      <p class="card-description">${description}</p>
    </div>${extraHtml}
  </div>
</body>
</html>`
}

function waitForCallback(port: number, state: string): Promise<{ apiKey: string; publishableKey?: string; projectId?: string; project: string }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close()
      server.closeAllConnections()
      reject(new Error('Login timed out after 5 minutes. Please try again.'))
    }, 5 * 60 * 1000)

    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://localhost:${port}`)

      if (url.pathname === '/callback') {
        const apiKey = url.searchParams.get('api_key')
        const publishableKey = url.searchParams.get('publishable_key')
        const projectId = url.searchParams.get('project_id')
        const project = url.searchParams.get('project')
        const returnedState = url.searchParams.get('state')
        const error = url.searchParams.get('error')
        const errorDescription = url.searchParams.get('error_description')

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(callbackPage('Login failed', 'Something went wrong. You can close this window.', 'error'))
          clearTimeout(timeout)
          server.close()
          server.closeAllConnections()
          reject(new Error(errorDescription || error))
          return
        }

        if (!apiKey || returnedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end(callbackPage('Invalid callback', 'Missing API key or state mismatch. Please try logging in again.', 'error'))
          return
        }

        res.writeHead(200, { 'Content-Type': 'text/html' })
        const skillCommand = 'npx skills add openfort-xyz/agent-skills --skill openfort'
        const agentSkillHtml = `
    <div class="card-extra">
      <p class="card-extra-title">Build with AI? Add the Openfort skill:</p>
      <div class="code-block">
        <code>${skillCommand}</code>
        <button onclick="navigator.clipboard.writeText('${skillCommand}');this.innerHTML='<svg width=&quot;14&quot; height=&quot;14&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; stroke-width=&quot;2&quot; stroke-linecap=&quot;round&quot; stroke-linejoin=&quot;round&quot;><polyline points=&quot;20 6 9 17 4 12&quot;/></svg>';setTimeout(()=>this.innerHTML='<svg width=&quot;14&quot; height=&quot;14&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; stroke-width=&quot;2&quot; stroke-linecap=&quot;round&quot; stroke-linejoin=&quot;round&quot;><rect x=&quot;9&quot; y=&quot;9&quot; width=&quot;13&quot; height=&quot;13&quot; rx=&quot;2&quot; ry=&quot;2&quot;/><path d=&quot;M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1&quot;/></svg>',2000)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
      </div>
      <a class="card-extra-link" href="https://www.openfort.io/docs/overview/building-with-cli" target="_blank" rel="noopener noreferrer">Learn more about building with the CLI</a>
    </div>`
        res.end(callbackPage('Login successful!', 'You can close this window and return to your terminal.', 'success', agentSkillHtml))
        clearTimeout(timeout)
        server.close()
        server.closeAllConnections()
        resolve({ apiKey, publishableKey: publishableKey || undefined, projectId: projectId || undefined, project: project || 'unknown' })
      } else {
        res.writeHead(404)
        res.end()
      }
    })

    server.listen(port)
  })
}


export const login = Cli.create('login', {
  description: 'Log in to Openfort via browser and save your API key.',
  output: z.object({
    apiKey: z.string().describe('The API key saved to credentials'),
    project: z.string().describe('The project name'),
    credentialsPath: z.string().describe('Path to the credentials file'),
  }),
  async run(c) {
    const state = generateState()
    const port = CLI_CALLBACK_PORT
    const redirectUri = `http://localhost:${port}/callback`

    // Construct URL to auth page
    const authUrl = new URL(`${AUTH_PAGE_URL}/oauth/consent`)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('state', state)

    if (!c.agent) {
      const url = authUrl.toString()
      console.log(`\n> Visit ${url}`)

      try {
        const browserProcess = await open(url)
        browserProcess.on('error', () => {})
      } catch {}

      console.log('Waiting for authentication...\n')
    }

    // Wait for auth page to redirect back with api_key
    const { apiKey, publishableKey, projectId, project } = await waitForCallback(port, state)

    // Write to global credentials file
    ensureConfigDir()
    writeEnvKey(CREDENTIALS_PATH, 'OPENFORT_API_KEY', apiKey)
    if (publishableKey) {
      writeEnvKey(CREDENTIALS_PATH, 'OPENFORT_PUBLISHABLE_KEY', publishableKey)
    }
    if (projectId) {
      writeEnvKey(CREDENTIALS_PATH, 'OPENFORT_PROJECT_ID', projectId)
    }

    if (!c.agent) {
      console.log(`Saved API key for project "${project}" to ${CREDENTIALS_PATH}`)
    }

    return c.ok(
      { apiKey, project, credentialsPath: CREDENTIALS_PATH },
      {
        cta: {
          description: 'Next steps:',
          commands: [
            { command: `backend-wallet setup`, description: 'Set up signing keys for backend wallets' },
          ],
        },
      },
    )
  },
})
