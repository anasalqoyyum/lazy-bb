import type { PullRequest, PullRequestDetail } from '../bitbucket/models'
import { clamp, firstLine, formatDate } from './format'
import { getIcons } from './icons'
import { branchName, detailKey, displayAccount, repoName } from './prUtils'

const icons = getIcons()

export function renderDetail(
  pr: PullRequest | undefined,
  detail: PullRequestDetail | undefined,
  loadingDetailKey: string | undefined,
  detailErrorKey: string | undefined,
  detailError: string | undefined,
  scroll: number,
  visibleLines: number
): string {
  if (!pr) return '\nSelect a pull request'

  const key = detailKey(pr)
  const loading = loadingDetailKey === key
  if (!detail && loading) {
    return [
      '',
      `⠋ Loading PR #${pr.id}`,
      '',
      `Repo: ${repoName(pr)}`,
      'Fetching overview, activity, comments, tasks, commits, and changes…'
    ].join('\n')
  }

  if (!detail && detailErrorKey === key && detailError) {
    return ['', `Could not load PR #${pr.id}`, '', `Repo: ${repoName(pr)}`, detailError].join('\n')
  }

  const fullPr = detail?.pr ?? pr
  const author = displayAccount(fullPr.author)
  const source = branchName(fullPr.source) || 'unknown'
  const destination = branchName(fullPr.destination) || 'unknown'
  const reviewers = fullPr.reviewers?.map(displayAccount).filter(Boolean).join(', ') || 'none'
  const description = fullPr.description?.trim() || 'No description'
  const status = aggregateStatus(detail?.statuses ?? [])

  const lines = [
    `#${fullPr.id} ${fullPr.title}`,
    `${icons.user} by ${author}  ·  Updated: ${formatDate(fullPr.updated_on)}`,
    '',
    `Repo:   ${repoName(fullPr)}`,
    `Branch: ${icons.branch} ${source} → ${destination}`,
    `State:  ${fullPr.state}  Checks: ${status}`,
    loading ? 'Loading details…' : detailError ? `Detail load failed: ${detailError}` : '',
    '',
    'Sections',
    `  • Overview`,
    `  • Activity  ${detail?.activity.length ?? 0}`,
    `  • Comments  ${detail?.comments.length ?? fullPr.comment_count ?? 0}`,
    `  • Tasks     ${detail?.tasks.length ?? fullPr.task_count ?? 0}`,
    `  • Commits   ${detail?.commits.length ?? 0}`,
    `  • Changes   ${detail?.diffstat.length ?? 0}`,
    '────────────────────────────────────────────────────────',
    '',
    'Description',
    ...description.split('\n'),
    '',
    `Reviewers (${fullPr.reviewers?.length ?? 0})`,
    reviewers,
    '',
    'Statuses',
    ...renderStatuses(detail),
    '',
    'Activity',
    ...renderActivity(detail),
    '',
    'Comments',
    ...renderComments(detail),
    '',
    'Tasks',
    ...renderTasks(detail),
    '',
    'Commits',
    ...renderCommits(detail),
    '',
    'Changes',
    ...renderChanges(detail)
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

function renderStatuses(detail: PullRequestDetail | undefined): string[] {
  if (!detail) return ['No status data loaded yet']
  if (detail.statuses.length === 0) return ['No statuses']
  return detail.statuses.slice(0, 8).map(status => `${status.state ?? 'UNKNOWN'} ${status.name || status.key || 'check'}`)
}

function renderActivity(detail: PullRequestDetail | undefined): string[] {
  if (!detail) return ['No activity loaded yet']
  if (detail.activity.length === 0) return ['No activity']
  return detail.activity.slice(0, 8).map(item => {
    if (item.approval) return `${formatDate(item.approval.date)} ${displayAccount(item.approval.user)} approved`
    if (item.comment) return `${formatDate(item.comment.created_on)} ${displayAccount(item.comment.user)} commented`
    if (item.update)
      return `${formatDate(item.update.date)} ${displayAccount(item.update.author)} updated ${branchName(item.update.source)} → ${branchName(item.update.destination)}`
    return 'Activity update'
  })
}

function renderComments(detail: PullRequestDetail | undefined): string[] {
  if (!detail) return ['No comments loaded yet']
  if (detail.comments.length === 0) return ['No comments']
  return detail.comments.slice(0, 8).flatMap(comment => {
    const location = comment.inline?.path ? ` (${comment.inline.path}:${comment.inline.to ?? comment.inline.from ?? ''})` : ''
    const body = comment.deleted ? '[deleted]' : comment.content?.raw?.trim() || 'No content'
    return [
      `${displayAccount(comment.user)}${location}`,
      ...body
        .split('\n')
        .slice(0, 3)
        .map(line => `  ${line}`)
    ]
  })
}

function renderTasks(detail: PullRequestDetail | undefined): string[] {
  if (!detail) return ['No tasks loaded yet']
  if (detail.tasks.length === 0) return ['No tasks']
  return detail.tasks.slice(0, 8).map(task => `${task.state ?? 'OPEN'} ${task.content?.raw?.trim() || `Task #${task.id}`}`)
}

function renderCommits(detail: PullRequestDetail | undefined): string[] {
  if (!detail) return ['No commits loaded yet']
  if (detail.commits.length === 0) return ['No commits']
  return detail.commits.slice(0, 8).map(commit => `${(commit.hash || '').slice(0, 12)} ${firstLine(commit.message)}`)
}

function renderChanges(detail: PullRequestDetail | undefined): string[] {
  if (!detail) return ['No changes loaded yet']
  if (detail.diffstat.length === 0) return ['No changes']
  return detail.diffstat.slice(0, 12).map(file => {
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
