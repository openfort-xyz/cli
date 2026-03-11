import { randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import { z } from 'incur'
import { AUTH_PAGE_URL, CLI_CALLBACK_PORT } from '../constants.js'
import { CREDENTIALS_PATH, ensureConfigDir } from '../config.js'
import { writeEnvKey } from '../env.js'

function base64url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function generateState(): string {
  return base64url(randomBytes(16))
}

function callbackPage(title: string, description: string, variant: 'success' | 'error' = 'success'): string {
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
      max-width: 28rem;
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
  </style>
</head>
<body>
  <div class="card">
    <div class="card-header">
      <div class="card-icon">${icon}</div>
      <h1 class="card-title">${title}</h1>
      <p class="card-description">${description}</p>
    </div>
  </div>
</body>
</html>`
}

function waitForCallback(port: number, state: string): Promise<{ apiKey: string; publishableKey?: string; projectId?: string; project: string }> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close()
      reject(new Error('Login timed out after 5 minutes. Please try again.'))
    }, 5 * 60 * 1000)

    const server = createServer((req, res) => {
      const url = new URL(req.url!, `http://localhost:${port}`)

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
          reject(new Error(errorDescription || error))
          return
        }

        if (!apiKey || returnedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end(callbackPage('Invalid callback', 'Missing API key or state mismatch. Please try logging in again.', 'error'))
          return
        }

        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(callbackPage('Login successful!', 'You can close this window and return to your terminal.'))
        clearTimeout(timeout)
        server.close()
        resolve({ apiKey, publishableKey: publishableKey || undefined, projectId: projectId || undefined, project: project || 'unknown' })
      } else {
        res.writeHead(404)
        res.end()
      }
    })

    server.listen(port)
  })
}


export const loginConfig = {
  description: 'Log in to Openfort via browser and save your API key.',
  output: z.object({
    apiKey: z.string().describe('The API key saved to credentials'),
    project: z.string().describe('The project name'),
    credentialsPath: z.string().describe('Path to the credentials file'),
  }),
  async run(c: any) {
    const state = generateState()
    const port = CLI_CALLBACK_PORT
    const redirectUri = `http://localhost:${port}/callback`

    // Construct URL to auth page
    const authUrl = new URL(`${AUTH_PAGE_URL}/oauth/consent`)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('state', state)

    console.log('\nOpen this URL in your browser to log in:\n')
    console.log(`  ${authUrl.toString()}\n`)
    console.log('Waiting for authentication...\n')

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

    console.log(`Saved API key for project "${project}" to ${CREDENTIALS_PATH}`)

    return c.ok(
      { apiKey, project, credentialsPath: CREDENTIALS_PATH },
      {
        cta: {
          description: 'Next steps:',
          commands: [
            { command: 'accounts evm list', description: 'List your accounts' },
            { command: 'contracts list', description: 'List your contracts' },
            { command: 'policies list', description: 'List your policies' },
          ],
        },
      },
    )
  },
} as const
