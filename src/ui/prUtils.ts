import type { PullRequest } from '../bitbucket/models'
import type { AppConfig } from '../config'

export type FocusPane = 'prs' | 'detail'
export type PrTab = 'mine' | 'review' | 'current'

export function currentUserIdentity(config: AppConfig) {
  return { username: config.user, displayName: config.displayName }
}

export function currentRepoSlugs(config: AppConfig): string[] {
  if (config.repoSlugs.length > 0) return config.repoSlugs
  return config.repo ? [config.repo] : []
}

export function tabLabel(tab: PrTab, repoSlugs: string[]): string {
  if (tab === 'mine') return 'my pull requests'
  if (tab === 'review') return 'pull requests needing my review'
  if (repoSlugs.length === 0) return 'current repo pull requests'
  if (repoSlugs.length === 1) return `${repoSlugs[0]} pull requests`
  return `${repoSlugs.length} filtered repos pull requests`
}

export function tabTitle(tab: PrTab): string {
  if (tab === 'mine') return 'My Pull Requests'
  if (tab === 'review') return 'Needs My Review'
  return 'Current Repo Pull Requests'
}

export function filterPrs(prs: PullRequest[], search: string): PullRequest[] {
  const query = search.trim().toLowerCase()
  if (!query) return prs

  return prs.filter(pr => {
    const haystack = [pr.title, pr.description, pr.author?.display_name, pr.author?.username, repoName(pr), String(pr.id)]
      .join(' ')
      .toLowerCase()
    return haystack.includes(query)
  })
}

export function branchName(ref: PullRequest['source']): string {
  return ref?.branch?.name || ref?.name || ''
}

export function repoName(pr: PullRequest | undefined): string {
  return (
    pr?.destination?.repository?.full_name ||
    pr?.source?.repository?.full_name ||
    pr?.destination?.repository?.name ||
    pr?.source?.repository?.name ||
    pr?.destination?.repository?.slug ||
    pr?.source?.repository?.slug ||
    'unknown'
  )
}

export function prRepoSlug(pr: PullRequest): string {
  const repo = pr.destination?.repository || pr.source?.repository
  if (repo?.slug) return repo.slug
  const fullName = repo?.full_name
  return fullName?.includes('/') ? fullName.split('/').pop() || '' : ''
}

export function detailKey(pr: PullRequest): string {
  return `${repoName(pr)}#${pr.id}`
}

export function groupPrsByRepo(prs: PullRequest[]): Array<{ repo: string; prs: PullRequest[] }> {
  const groups = new Map<string, PullRequest[]>()
  for (const pr of prs) {
    const repo = repoName(pr)
    groups.set(repo, [...(groups.get(repo) ?? []), pr])
  }
  return [...groups.entries()].map(([repo, prs]) => ({ repo, prs }))
}

export function flattenGroupedPrs(prs: PullRequest[]): PullRequest[] {
  return groupPrsByRepo(prs).flatMap(group => group.prs)
}

export function compareUpdatedDesc(a: PullRequest, b: PullRequest): number {
  return new Date(b.updated_on ?? 0).getTime() - new Date(a.updated_on ?? 0).getTime()
}

export function displayAccount(account: PullRequest['author']): string {
  return account?.display_name || account?.nickname || account?.username || 'unknown'
}
