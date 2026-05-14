export type RemoteLocator = {
  host: string
  kind: 'cloud' | 'dc'
  workspace?: string
  projectKey?: string
  repoSlug: string
}

export async function detectRemote(cwd = '.'): Promise<RemoteLocator | undefined> {
  const remotes = await listRemotes(cwd)
  const orderedUrls = orderRemoteUrls(remotes)

  for (const url of orderedUrls) {
    const locator = parseRemoteLocator(url)
    if (locator?.repoSlug) {
      return locator
    }
  }

  return undefined
}

export async function listRemotes(cwd = '.'): Promise<Map<string, string[]>> {
  const proc = Bun.spawn(['git', '-C', cwd, 'remote', '-v'], {
    env: { ...Bun.env, GIT_TERMINAL_PROMPT: '0' },
    stdout: 'pipe',
    stderr: 'pipe'
  })

  const [stdout, stderr, exitCode] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])

  if (exitCode !== 0) {
    const message = stderr.trim()
    if (message.includes('not a git repository')) {
      return new Map()
    }
    throw new Error(message || 'git remote -v failed')
  }

  const remotes = new Map<string, string[]>()

  for (const line of stdout.split('\n')) {
    const fields = line.trim().split(/\s+/)
    if (fields.length < 2) continue

    const [name, url] = fields
    const urls = remotes.get(name) ?? []
    if (!urls.includes(url)) {
      urls.push(url)
    }
    remotes.set(name, urls)
  }

  return remotes
}

export function parseRemoteLocator(raw: string): RemoteLocator | undefined {
  const dissected = dissectRemote(raw)
  if (!dissected || dissected.segments.length < 2) return undefined

  const { host, segments } = dissected

  if (host === 'bitbucket.org') {
    return {
      host,
      kind: 'cloud',
      workspace: segments[0],
      repoSlug: segments[1]
    }
  }

  const dc = extractDataCenterProjectRepo(segments)
  if (!dc) return undefined

  return {
    host,
    kind: 'dc',
    projectKey: dc.projectKey.toUpperCase(),
    repoSlug: dc.repoSlug
  }
}

function orderRemoteUrls(remotes: Map<string, string[]>): string[] {
  const urls: string[] = []
  const add = (candidate: string) => {
    if (!urls.includes(candidate)) urls.push(candidate)
  }

  for (const name of ['origin', 'upstream']) {
    for (const url of remotes.get(name) ?? []) add(url)
  }

  for (const [name, remoteUrls] of remotes) {
    if (name === 'origin' || name === 'upstream') continue
    for (const url of remoteUrls) add(url)
  }

  return urls
}

function dissectRemote(raw: string): { host: string; segments: string[] } | undefined {
  const value = raw.trim()
  if (!value) return undefined

  if (value.includes('://')) {
    try {
      const url = new URL(value)
      return {
        host: hostWithoutPort(url.host),
        segments: splitSegments(url.pathname)
      }
    } catch {
      return undefined
    }
  }

  const colon = value.indexOf(':')
  if (colon === -1) return undefined

  const hostPart = value.slice(0, colon).split('@').at(-1) ?? ''
  const pathPart = value.slice(colon + 1)

  return {
    host: hostWithoutPort(hostPart),
    segments: splitSegments(pathPart)
  }
}

function splitSegments(path: string): string[] {
  const segments = path
    .trim()
    .replace(/^\/+/, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '')
    .split('/')
    .map(segment => segment.trim())
    .filter(Boolean)

  if (segments.length > 0) {
    segments[segments.length - 1] = segments[segments.length - 1].replace(/\.git$/, '')
  }

  return segments
}

function extractDataCenterProjectRepo(segments: string[]): { projectKey: string; repoSlug: string } | undefined {
  if (segments.length >= 4 && segments[0].toLowerCase() === 'projects' && segments[2].toLowerCase() === 'repos') {
    return { projectKey: segments[1], repoSlug: segments[3] }
  }

  if (segments.length >= 3 && segments[0].toLowerCase() === 'scm') {
    return { projectKey: segments[1], repoSlug: segments[2] }
  }

  if (segments.length >= 2) {
    return { projectKey: segments[0], repoSlug: segments[1] }
  }

  return undefined
}

function hostWithoutPort(host: string): string {
  const trimmed = host.trim().replace(/^\[/, '').replace(/]$/, '')
  const parts = trimmed.split(':')
  return parts[0].toLowerCase()
}
