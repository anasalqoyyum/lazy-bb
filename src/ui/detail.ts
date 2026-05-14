import type { PullRequest, PullRequestDetail } from '../bitbucket/models'
import { clamp, firstLine, formatDate } from './format'
import { getIcons } from './icons'
import { branchName, detailKey, displayAccount, repoName } from './prUtils'

const icons = getIcons()

export type DetailTab = 'overview' | 'activity' | 'comments' | 'commits' | 'changes'

export function renderDetail(
  pr: PullRequest | undefined,
  detail: PullRequestDetail | undefined,
  loadingDetailKey: string | undefined,
  detailErrorKey: string | undefined,
  detailError: string | undefined,
  tab: DetailTab,
  scroll: number,
  visibleLines: number
): string {
  if (!pr) return '\nSelect a pull request'

  const key = detailKey(pr)
  const loading = loadingDetailKey === key
  const fullPr = detail?.pr ?? pr
  const author = displayAccount(fullPr.author)
  const source = branchName(fullPr.source) || 'unknown'
  const destination = branchName(fullPr.destination) || 'unknown'
  const description = fullPr.description?.trim() || 'No description'
  const status = aggregateStatus(detail?.statuses ?? [])
  const errorLine = detailErrorKey === key && detailError ? `Detail load failed: ${detailError}` : ''

  const lines = [
    `#${fullPr.id} ${fullPr.title}`,
    `${icons.user} by ${author}  ·  Updated: ${formatDate(fullPr.updated_on)}`,
    '',
    `Repo:   ${repoName(fullPr)}`,
    `Branch: ${icons.branch} ${source} → ${destination}`,
    `State:  ${fullPr.state}  Checks: ${detail ? status : loading ? 'loading…' : 'pending'}`,
    errorLine,
    '',
    renderTabs(tab, detail, fullPr),
    '',
    ...renderTabContent(tab, fullPr, detail, description, loading)
  ].filter(line => line !== undefined)
  const maxScroll = Math.max(0, lines.length - visibleLines)
  const safeScroll = clamp(scroll, 0, maxScroll)
  const marker = maxScroll > 0 ? `  [${safeScroll + 1}-${Math.min(lines.length, safeScroll + visibleLines)}/${lines.length}]` : ''

  return [...lines.slice(safeScroll, safeScroll + visibleLines), marker].join('\n')
}

export function detailVisibleLines(height: number, debug: boolean, networkRequestCount: number): number {
  const debugHeight = debug ? Math.min(6, Math.max(3, networkRequestCount + 2)) : 0
  return Math.max(4, height - debugHeight - 10)
}

export function maxDetailScroll(pr: PullRequest | undefined, height: number): number {
  if (!pr) return 0
  const descriptionLines = (pr.description?.trim() || 'No description').split('\n').length
  return Math.max(0, 80 + descriptionLines - detailVisibleLines(height, false, 0))
}

function renderTabs(tab: DetailTab, detail: PullRequestDetail | undefined, pr: PullRequest): string {
  const tabs: Array<[DetailTab, string, number | undefined]> = [
    ['overview', 'Overview', undefined],
    ['activity', 'Activity', detail?.activity.length],
    ['comments', 'Comments', detail?.comments.length ?? pr.comment_count],
    ['commits', 'Commits', detail?.commits.length],
    ['changes', 'Changes', detail?.diffstat.length]
  ]

  return tabs.map(([key, label, count]) => `${key === tab ? '▸' : ' '} ${label}${count === undefined ? '' : ` ${count}`}`).join('  ')
}

function renderTabContent(
  tab: DetailTab,
  pr: PullRequest,
  detail: PullRequestDetail | undefined,
  description: string,
  loading: boolean
): string[] {
  if (tab === 'overview') return renderOverview(pr, detail, description, loading)
  if (tab === 'activity') return renderActivity(detail, loading)
  if (tab === 'comments') return renderComments(detail, loading)
  if (tab === 'commits') return renderCommits(detail, loading)
  return renderChanges(detail, loading)
}

function renderOverview(pr: PullRequest, detail: PullRequestDetail | undefined, description: string, loading: boolean): string[] {
  return [
    'Description',
    ...description.split('\n'),
    '',
    ...renderReviewers(pr),
    '',
    'Builds',
    ...renderStatuses(detail, loading),
    '',
    loading ? 'Loading activity, comments, commits, and changes in the background…' : ''
  ]
}

function renderReviewers(pr: PullRequest): string[] {
  const participants = (pr.participants ?? []).filter(participant => participant.role?.toUpperCase() === 'REVIEWER')
  const reviewers: Array<{ user: PullRequest['author']; state?: string }> =
    participants.length > 0
      ? participants.map(participant => ({ user: participant.user, state: participant.state }))
      : (pr.reviewers ?? []).map(user => ({ user }))
  const approved = reviewers.filter(reviewer => reviewer.state === 'approved').map(reviewer => displayAccount(reviewer.user))
  const changesRequested = reviewers
    .filter(reviewer => reviewer.state === 'changes_requested')
    .map(reviewer => displayAccount(reviewer.user))
  const pending = reviewers
    .filter(reviewer => reviewer.state !== 'approved' && reviewer.state !== 'changes_requested')
    .map(reviewer => displayAccount(reviewer.user))

  const lines = [`Reviewers (${approved.length}/${reviewers.length})`]
  if (reviewers.length === 0) return [...lines, 'No reviewers']

  if (approved.length > 0) lines.push(`${icons.checks} ${approved.sort().join(', ')}`)
  if (changesRequested.length > 0) lines.push(`✕ ${changesRequested.sort().join(', ')}`)
  if (pending.length > 0) lines.push(`◌ ${pending.sort().join(', ')}`)
  return lines
}

function renderStatuses(detail: PullRequestDetail | undefined, loading: boolean): string[] {
  if (!detail) return [loading ? '⠋ Loading builds…' : 'No status data loaded yet']
  if (detail.statuses.length === 0) return ['No statuses']
  return detail.statuses.slice(0, 8).map(status => {
    const state = status.state ?? 'UNKNOWN'
    return `${statusIcon(state)} ${status.name || status.key || 'check'} (${statusLabel(state)})`
  })
}

function statusIcon(state: string): string {
  const normalized = state.toUpperCase()
  if (normalized === 'SUCCESSFUL') return icons.checks
  if (normalized === 'FAILED') return '✕'
  if (normalized === 'INPROGRESS') return '◌'
  return icons.dot
}

function statusLabel(state: string): string {
  const normalized = state.toLowerCase()
  return normalized ? normalized[0].toUpperCase() + normalized.slice(1) : 'Unknown'
}

function renderActivity(detail: PullRequestDetail | undefined, loading: boolean): string[] {
  if (!detail) return [loading ? '⠋ Loading activity…' : 'No activity loaded yet']
  if (detail.activity.length === 0) return ['No activity']
  return detail.activity.slice(0, 14).map(item => {
    if (item.approval) return `${formatDate(item.approval.date)} ${displayAccount(item.approval.user)} approved`
    if (item.comment) return `${formatDate(item.comment.created_on)} ${displayAccount(item.comment.user)} commented`
    if (item.update)
      return `${formatDate(item.update.date)} ${displayAccount(item.update.author)} updated ${branchName(item.update.source)} → ${branchName(item.update.destination)}`
    return 'Activity update'
  })
}

function renderComments(detail: PullRequestDetail | undefined, loading: boolean): string[] {
  if (!detail) return [loading ? '⠋ Loading comments…' : 'No comments loaded yet']
  if (detail.comments.length === 0) return ['No comments']
  return detail.comments.slice(0, 10).flatMap(comment => {
    const location = comment.inline?.path ? ` (${comment.inline.path}:${comment.inline.to ?? comment.inline.from ?? ''})` : ''
    const body = comment.deleted ? '[deleted]' : comment.content?.raw?.trim() || 'No content'
    return [
      `${displayAccount(comment.user)}${location}`,
      ...body
        .split('\n')
        .slice(0, 4)
        .map(line => `  ${line}`)
    ]
  })
}

function renderCommits(detail: PullRequestDetail | undefined, loading: boolean): string[] {
  if (!detail) return [loading ? '⠋ Loading commits…' : 'No commits loaded yet']
  if (detail.commits.length === 0) return ['No commits']
  return detail.commits.slice(0, 16).map(commit => `${(commit.hash || '').slice(0, 12)} ${firstLine(commit.message)}`)
}

function renderChanges(detail: PullRequestDetail | undefined, loading: boolean): string[] {
  if (!detail) return [loading ? '⠋ Loading changes…' : 'No changes loaded yet']
  if (detail.diffstat.length === 0) return ['No changes']
  return detail.diffstat.slice(0, 18).map(file => {
    const path = file.new?.path || file.old?.path || 'unknown'
    return `${file.status ?? 'modified'} +${file.lines_added ?? 0} -${file.lines_removed ?? 0} ${path}`
  })
}

function aggregateStatus(statuses: PullRequestDetail['statuses']): string {
  if (statuses.length === 0) return 'unknown'
  if (statuses.some(status => status.state === 'FAILED')) return 'failed'
  if (statuses.some(status => status.state === 'INPROGRESS')) return 'in progress'
  if (statuses.some(status => status.state === 'STOPPED')) return 'stopped'
  if (statuses.some(status => status.state === 'SUCCESSFUL')) return 'successful'
  return 'unknown'
}
