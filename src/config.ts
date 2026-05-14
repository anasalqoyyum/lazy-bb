import { detectRemote } from './git/remote'

export type AppConfig = {
  user: string
  displayName?: string
  token: string
  workspace: string
  repo?: string
  repoSlugs: string[]
  pullRequestState: string
  cacheTtlSeconds: number
  debug: boolean
  inferredFromGit: boolean
}

export async function loadConfig(): Promise<AppConfig> {
  await loadDotEnvFile()

  const user = env('BKT_USER')
  const displayName = env('BKT_DISPLAY_NAME') || undefined
  const token = env('BKT_TOKEN')
  const remote = !env('BKT_WORKSPACE') || !env('BKT_REPO') ? await detectRemote().catch(() => undefined) : undefined
  const filter = parseFilter(env('BKT_FILTER'))
  const workspace = env('BKT_WORKSPACE') || filter.workspace || remote?.workspace || ''
  const repoValue = env('BKT_REPOS') || env('BKT_REPO') || filter.repo || remote?.repoSlug || ''
  const repoSlugs = splitList(repoValue)
  const repo = repoSlugs[0]
  const pullRequestState = (env('BKT_PR_STATE') || filter.state || 'OPEN').toUpperCase()
  const cacheTtlSeconds = parseCacheTtl(env('BKT_CACHE_TTL'))
  const debug = parseDebugFlag()

  const missing: string[] = []
  if (!user) missing.push('BKT_USER')
  if (!token) missing.push('BKT_TOKEN')
  if (!workspace) missing.push('BKT_WORKSPACE')

  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`)
  }

  return {
    user,
    displayName,
    token,
    workspace,
    repo,
    repoSlugs,
    pullRequestState,
    cacheTtlSeconds,
    debug,
    inferredFromGit: !env('BKT_WORKSPACE') && Boolean(remote?.workspace)
  }
}

function env(name: string): string {
  return Bun.env[name]?.trim() ?? ''
}

function splitList(value: string): string[] {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function parseFilter(value: string): { workspace?: string; repo?: string; state?: string } {
  const filter: { workspace?: string; repo?: string; state?: string } = {}

  for (const part of value.split(/\s+/)) {
    const index = part.indexOf(':')
    if (index === -1) continue

    const key = part.slice(0, index).toLowerCase()
    const rawValue = part.slice(index + 1).trim()
    if (!rawValue) continue

    if (key === 'workspace') filter.workspace = rawValue
    if (key === 'repo') filter.repo = rawValue
    if (key === 'is' || key === 'state') filter.state = rawValue
  }

  return filter
}

function parseCacheTtl(value: string): number {
  if (!value) return 300

  const ttl = Number(value)
  if (!Number.isFinite(ttl) || ttl < 0) {
    throw new Error('BKT_CACHE_TTL must be a non-negative number of seconds')
  }

  return ttl
}

function parseDebugFlag(): boolean {
  const envValue = env('BKT_DEBUG') || env('LAZY_BB_DEBUG')
  if (envValue === '1' || envValue.toLowerCase() === 'true') return true
  if (envValue === '0' || envValue.toLowerCase() === 'false') return false

  return Bun.argv.includes('--debug')
}

async function loadDotEnvFile(): Promise<void> {
  const file = Bun.file('.env')
  if (!(await file.exists())) return

  const content = await file.text()

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const equalsIndex = trimmed.indexOf('=')
    if (equalsIndex === -1) continue

    const key = trimmed.slice(0, equalsIndex).trim()
    const rawValue = trimmed.slice(equalsIndex + 1).trim()
    const value = rawValue.replace(/^['"]|['"]$/g, '')

    if (!Bun.env[key]) {
      Bun.env[key] = value
    }
  }
}
