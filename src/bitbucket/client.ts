import type { CommitStatus, Page, PullRequest, PullRequestActivity, PullRequestComment, PullRequestCommit, PullRequestDetail, PullRequestDiffstat, PullRequestTask, Repository } from "./models"

type CacheEntry<T> = {
  expiresAt: number
  value: T
}

export type NetworkRequestLog = {
  method: "GET"
  url: string
  status: number | "CACHE" | "ERR"
  durationMs: number
  cached: boolean
  timestamp: Date
}

export class BitbucketHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export type BitbucketUserIdentity = {
  username: string
  displayName?: string
}

function needsReview(pr: PullRequest, identity: BitbucketUserIdentity): boolean {
  const normalizedValues = [identity.username, identity.displayName].filter(Boolean).map((value) => value!.toLowerCase())
  const reviewers = pr.reviewers ?? []
  const participantReviewers = (pr.participants ?? [])
    .filter((participant) => participant.role?.toUpperCase() === "REVIEWER")
    .map((participant) => participant.user)
    .filter((user) => user !== undefined)

  return [...reviewers, ...participantReviewers].some((reviewer) => {
    const ids = [reviewer.username, reviewer.nickname, reviewer.uuid, reviewer.account_id, reviewer.display_name]
    return ids.some((id) => id && normalizedValues.includes(id.toLowerCase()))
  })
}

export class BitbucketClient {
  private readonly baseUrl = "https://api.bitbucket.org/2.0"
  private readonly cache = new Map<string, CacheEntry<unknown>>()

  constructor(
    private readonly user: string,
    private readonly token: string,
    private readonly workspace: string,
    private readonly cacheTtlSeconds: number,
    private readonly onRequest?: (request: NetworkRequestLog) => void,
  ) {}

  async listRepositories(options: { refresh?: boolean } = {}): Promise<Repository[]> {
    return this.fetchPages<Repository>(`${this.baseUrl}/repositories/${this.workspace}?role=member&pagelen=50`, options)
  }

  async getRepository(repoSlug: string, options: { refresh?: boolean } = {}): Promise<Repository> {
    const encodedRepo = encodeURIComponent(repoSlug)
    return this.request<Repository>(`${this.baseUrl}/repositories/${this.workspace}/${encodedRepo}`, options)
  }

  async listPullRequests(repoSlug: string, state = "OPEN", options: { refresh?: boolean } = {}): Promise<PullRequest[]> {
    return this.listRepoPullRequests(repoSlug, state, undefined, options)
  }

  async getPullRequest(repoSlug: string, prId: number, options: { refresh?: boolean } = {}): Promise<PullRequest> {
    const encodedRepo = encodeURIComponent(repoSlug)
    return this.request<PullRequest>(`${this.baseUrl}/repositories/${this.workspace}/${encodedRepo}/pullrequests/${prId}`, options)
  }

  async getPullRequestDetail(repoSlug: string, prId: number, options: { refresh?: boolean } = {}): Promise<PullRequestDetail> {
    const pr = await this.getPullRequest(repoSlug, prId, options)
    const [commits, diffstat, activity, statuses, comments, tasks] = await Promise.all([
      this.optionalPages<PullRequestCommit>(pr.links?.commits?.href, options),
      this.optionalPages<PullRequestDiffstat>(pr.links?.diffstat?.href, options),
      this.optionalFetchPages<PullRequestActivity>(pr.links?.activity?.href, options),
      this.optionalPages<CommitStatus>(pr.links?.statuses?.href, options),
      this.optionalPages<PullRequestComment>(pr.links?.comments?.href, options),
      this.optionalFetchPages<PullRequestTask>(`${this.baseUrl}/repositories/${this.workspace}/${encodeURIComponent(repoSlug)}/pullrequests/${prId}/tasks?pagelen=100`, options),
    ])

    return { pr, commits, diffstat, activity, statuses, comments, tasks }
  }

  async listPullRequestsNeedingReview(identity: BitbucketUserIdentity, state = "OPEN", options: { refresh?: boolean } = {}): Promise<PullRequest[]> {
    return (await this.listWorkspaceUserPullRequests(identity.username, state, undefined, options)).filter((pr) => needsReview(pr, identity))
  }

  async listRepoPullRequestsNeedingReview(repoSlug: string, identity: BitbucketUserIdentity, state = "OPEN", options: { refresh?: boolean } = {}): Promise<PullRequest[]> {
    return (await this.listRepoPullRequests(repoSlug, state, undefined, options)).filter((pr) => needsReview(pr, identity))
  }

  async listMyPullRequests(username: string, state = "OPEN", options: { refresh?: boolean } = {}): Promise<PullRequest[]> {
    return this.listWorkspaceUserPullRequests(username, state, undefined, options)
  }

  private async listWorkspaceUserPullRequests(username: string, state: string, query: string | undefined, options: { refresh?: boolean }): Promise<PullRequest[]> {
    const encodedUser = encodeURIComponent(username)
    const queryParam = query ? `&q=${encodeURIComponent(query)}` : ""
    return this.fetchPages<PullRequest>(
      `${this.baseUrl}/workspaces/${this.workspace}/pullrequests/${encodedUser}?state=${encodeURIComponent(state)}&pagelen=50${queryParam}`,
      options,
    )
  }

  private async listRepoPullRequests(repoSlug: string, state: string, query: string | undefined, options: { refresh?: boolean }): Promise<PullRequest[]> {
    const encodedRepo = encodeURIComponent(repoSlug)
    const queryParam = query ? `&q=${encodeURIComponent(query)}` : ""
    return this.fetchPages<PullRequest>(
      `${this.baseUrl}/repositories/${this.workspace}/${encodedRepo}/pullrequests?state=${encodeURIComponent(state)}&pagelen=50${queryParam}`,
      options,
    )
  }

  private async fetchPages<T>(firstUrl: string, options: { refresh?: boolean } = {}): Promise<T[]> {
    const values: T[] = []
    let nextUrl: string | undefined = firstUrl

    while (nextUrl) {
      const page: Page<T> = await this.request<Page<T>>(nextUrl, options)
      values.push(...page.values)
      nextUrl = page.next
    }

    return values
  }

  private async fetchLinkPages<T>(url: string | undefined, options: { refresh?: boolean } = {}): Promise<T[]> {
    if (!url) return []
    const separator = url.includes("?") ? "&" : "?"
    return this.fetchPages<T>(`${url}${separator}pagelen=100`, options)
  }

  private async optionalPages<T>(url: string | undefined, options: { refresh?: boolean } = {}): Promise<T[]> {
    if (!url) return []
    try {
      return await this.fetchLinkPages<T>(url, options)
    } catch (error) {
      if (error instanceof BitbucketHttpError && error.status >= 400 && error.status < 500) return []
      throw error
    }
  }

  private async optionalFetchPages<T>(url: string | undefined, options: { refresh?: boolean } = {}): Promise<T[]> {
    if (!url) return []
    try {
      return await this.fetchPages<T>(url, options)
    } catch (error) {
      if (error instanceof BitbucketHttpError && error.status >= 400 && error.status < 500) return []
      throw error
    }
  }

  private async request<T>(url: string, options: { refresh?: boolean }): Promise<T> {
    const startedAt = Date.now()

    if (!options.refresh) {
      const cached = this.cache.get(url) as CacheEntry<T> | undefined
      if (cached && cached.expiresAt > Date.now()) {
        this.recordRequest({ url, status: "CACHE", durationMs: Date.now() - startedAt, cached: true })
        return cached.value
      }
    }

    let response: Response
    try {
      response = await fetch(url, {
        headers: {
          Accept: "application/json",
          Authorization: `Basic ${btoa(`${this.user}:${this.token}`)}`,
        },
      })
    } catch (error) {
      this.recordRequest({ url, status: "ERR", durationMs: Date.now() - startedAt, cached: false })
      throw error
    }

    this.recordRequest({ url, status: response.status, durationMs: Date.now() - startedAt, cached: false })

    if (!response.ok) {
      const body = await response.text()
      throw new BitbucketHttpError(response.status, `Bitbucket returned ${response.status}: ${body}`)
    }

    const value = (await response.json()) as T
    if (this.cacheTtlSeconds > 0) {
      this.cache.set(url, {
        value,
        expiresAt: Date.now() + this.cacheTtlSeconds * 1000,
      })
    }

    return value
  }

  private recordRequest(request: Omit<NetworkRequestLog, "method" | "timestamp">): void {
    this.onRequest?.({
      method: "GET",
      timestamp: new Date(),
      ...request,
    })
  }
}
