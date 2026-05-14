import { useKeyboard, useRenderer, useTerminalDimensions } from '@opentui/react'
import { useEffect, useState } from 'react'
import { BitbucketClient, BitbucketHttpError, type NetworkRequestLog } from '../bitbucket/client'
import type { PullRequest, PullRequestDetail } from '../bitbucket/models'
import type { AppConfig } from '../config'
import { openBrowser } from './browser'
import { copyToClipboard } from './clipboard'
import { getIcons } from './icons'
import { theme } from './theme'

type FocusPane = 'prs' | 'detail'
type PrTab = 'mine' | 'review' | 'current'

type AppState = {
  prs: PullRequest[]
  selectedPrIndex: number
  focus: FocusPane
  tab: PrTab
  loadingPrs: boolean
  error?: string
  status: string
  search: string
  searchMode: boolean
  pendingG: boolean
  detailScroll: number
  prDetails: Record<string, PullRequestDetail>
  loadingDetailKey?: string
  detailErrorKey?: string
  detailError?: string
  networkRequests: NetworkRequestLog[]
}

type Props = {
  config: AppConfig
}

const icons = getIcons()

export function App({ config }: Props) {
  const renderer = useRenderer()
  const { width, height } = useTerminalDimensions()
  const [state, setState] = useState<AppState>({
    prs: [],
    selectedPrIndex: 0,
    focus: 'prs',
    tab: 'mine',
    loadingPrs: true,
    status: 'Loading my pull requests',
    search: '',
    searchMode: false,
    pendingG: false,
    detailScroll: 0,
    prDetails: {},
    networkRequests: []
  })

  const [client] = useState(
    () =>
      new BitbucketClient(config.user, config.token, config.workspace, config.cacheTtlSeconds, request => {
        setState(current => ({
          ...current,
          networkRequests: [...current.networkRequests, request].slice(-8)
        }))
      })
  )
  const filteredPrs = filterPrs(state.prs, state.search)
  const displayedPrs = flattenGroupedPrs(filteredPrs)
  const selectedPr = displayedPrs[state.selectedPrIndex]

  useEffect(() => {
    void loadPullRequests('mine')
  }, [])

  useEffect(() => {
    if (!selectedPr) return
    void loadPullRequestDetail(selectedPr)
  }, [selectedPr?.id, repoName(selectedPr)])

  useKeyboard(key => {
    if (state.searchMode) {
      handleSearchKey(key)
      return
    }

    if (key.ctrl && key.name === 'c') {
      renderer.destroy()
      return
    }

    if (key.name === 'escape' || key.name === 'q') {
      renderer.destroy()
      return
    }

    if (key.name === '?') {
      setState(current => ({
        ...current,
        pendingG: false,
        status:
          'j/k move · h/l panes · 1 my PRs · 2 needs review · 3 repo/filter · gg/G top/bottom · / search · r refresh · o open · y yank · q quit'
      }))
      return
    }

    if (key.name === '/') {
      setState(current => ({
        ...current,
        searchMode: true,
        search: '',
        selectedPrIndex: 0,
        status: 'Search:'
      }))
      return
    }

    if (key.name === 'g') {
      if (state.pendingG) {
        jumpToStart()
        return
      }
      setState(current => ({ ...current, pendingG: true }))
      return
    }

    if (key.name !== 'g' && state.pendingG) {
      setState(current => ({ ...current, pendingG: false }))
    }

    switch (key.name) {
      case 'j':
      case 'down':
        if (state.focus === 'detail') scrollDetail(1)
        else move(1)
        break
      case 'k':
      case 'up':
        if (state.focus === 'detail') scrollDetail(-1)
        else move(-1)
        break
      case 'h':
      case 'left':
        setFocus('prs')
        break
      case 'l':
      case 'right':
        setFocus('detail')
        break
      case 'G':
        if (state.focus === 'detail') scrollDetailToEnd()
        else jumpToEnd()
        break
      case 'd':
        if (key.ctrl) {
          if (state.focus === 'detail') scrollDetail(Math.max(5, Math.floor(height / 2)))
          else page(1)
        }
        break
      case 'u':
        if (key.ctrl) {
          if (state.focus === 'detail') scrollDetail(-Math.max(5, Math.floor(height / 2)))
          else page(-1)
        }
        break
      case 'return':
      case 'o':
        openSelectedPr()
        break
      case 'y':
        yankSelectedPr()
        break
      case 'r':
        refresh()
        break
      case '1':
        void loadPullRequests('mine')
        break
      case '2':
        void loadPullRequests('review')
        break
      case '3':
        void loadPullRequests('current')
        break
    }
  })

  async function loadPullRequests(tab: PrTab, options: { refresh?: boolean } = {}) {
    const repoSlugs = currentRepoSlugs()
    const label = tabLabel(tab, repoSlugs)
    setState(current => ({
      ...current,
      tab,
      loadingPrs: true,
      error: undefined,
      prs: [],
      selectedPrIndex: 0,
      status: `Loading ${label}`
    }))
    try {
      const prs = await loadTabPullRequests(tab, repoSlugs, options)
      setState(current => ({
        ...current,
        prs,
        selectedPrIndex: 0,
        detailScroll: 0,
        loadingPrs: false,
        focus: 'prs',
        status:
          prs.length === 0
            ? `No ${config.pullRequestState.toLowerCase()} ${label}`
            : `Loaded ${prs.length} ${config.pullRequestState.toLowerCase()} PRs`
      }))
    } catch (error) {
      if (error instanceof BitbucketHttpError && error.status === 404) {
        setState(current => ({
          ...current,
          prs: [],
          selectedPrIndex: 0,
          loadingPrs: false,
          error: undefined,
          status: tab === 'mine' ? 'No pull requests found for this account' : `No pull requests found for ${label}`
        }))
        return
      }

      setState(current => ({
        ...current,
        loadingPrs: false,
        error: errorMessage(error),
        status: 'Pull request load failed'
      }))
    }
  }

  async function loadTabPullRequests(tab: PrTab, repoSlugs: string[], options: { refresh?: boolean }): Promise<PullRequest[]> {
    if (tab === 'mine') return client.listMyPullRequests(config.user, config.pullRequestState, options)
    if (tab === 'review' && repoSlugs.length === 0)
      return (await client.listPullRequestsNeedingReview(currentUserIdentity(config), config.pullRequestState, options)).sort(
        compareUpdatedDesc
      )

    if (repoSlugs.length === 0) return []

    const lists = await Promise.all(
      repoSlugs.map(async slug => {
        try {
          if (tab === 'review')
            return await client.listRepoPullRequestsNeedingReview(slug, currentUserIdentity(config), config.pullRequestState, options)
          return await client.listPullRequests(slug, config.pullRequestState, options)
        } catch (error) {
          if (error instanceof BitbucketHttpError && error.status === 404) return []
          throw error
        }
      })
    )
    return lists.flat().sort(compareUpdatedDesc)
  }

  async function loadPullRequestDetail(pr: PullRequest, options: { refresh?: boolean } = {}) {
    const repoSlug = prRepoSlug(pr)
    if (!repoSlug) return

    const key = detailKey(pr)
    if (!options.refresh && state.prDetails[key]) return

    setState(current => ({
      ...current,
      loadingDetailKey: key,
      detailErrorKey: undefined,
      detailError: undefined
    }))
    try {
      const detail = await client.getPullRequestDetail(repoSlug, pr.id, options)
      setState(current => ({
        ...current,
        prDetails: { ...current.prDetails, [key]: detail },
        loadingDetailKey: current.loadingDetailKey === key ? undefined : current.loadingDetailKey
      }))
    } catch (error) {
      setState(current => ({
        ...current,
        loadingDetailKey: current.loadingDetailKey === key ? undefined : current.loadingDetailKey,
        detailErrorKey: key,
        detailError: errorMessage(error)
      }))
    }
  }

  function currentRepoSlugs(): string[] {
    if (config.repoSlugs.length > 0) return config.repoSlugs
    return config.repo ? [config.repo] : []
  }

  function tabLabel(tab: PrTab, repoSlugs: string[]): string {
    if (tab === 'mine') return 'my pull requests'
    if (tab === 'review') return 'pull requests needing my review'
    if (repoSlugs.length === 0) return 'current repo pull requests'
    if (repoSlugs.length === 1) return `${repoSlugs[0]} pull requests`
    return `${repoSlugs.length} filtered repos pull requests`
  }

  function handleSearchKey(key: { name: string; sequence?: string; ctrl?: boolean }) {
    if (key.name === 'escape') {
      setState(current => ({
        ...current,
        searchMode: false,
        search: '',
        selectedPrIndex: 0,
        status: 'Search cancelled'
      }))
      return
    }

    if (key.name === 'return') {
      setState(current => ({
        ...current,
        searchMode: false,
        status: current.search ? `Filtered by ${current.search}` : 'Search cleared'
      }))
      return
    }

    if (key.name === 'backspace' || key.name === 'delete') {
      setState(current => ({
        ...current,
        search: current.search.slice(0, -1),
        selectedPrIndex: 0
      }))
      return
    }

    if (key.sequence && key.sequence.length === 1 && !key.ctrl) {
      setState(current => ({
        ...current,
        search: current.search + key.sequence,
        selectedPrIndex: 0
      }))
    }
  }

  function move(delta: number) {
    setState(current => ({
      ...current,
      selectedPrIndex: clamp(current.selectedPrIndex + delta, 0, filterPrs(current.prs, current.search).length - 1),
      detailScroll: 0,
      pendingG: false
    }))
  }

  function page(direction: number) {
    const amount = Math.max(5, Math.floor(height / 2))
    setState(current => ({
      ...current,
      selectedPrIndex: clamp(current.selectedPrIndex + amount * direction, 0, filterPrs(current.prs, current.search).length - 1),
      detailScroll: 0
    }))
  }

  function jumpToStart() {
    setState(current => ({
      ...current,
      selectedPrIndex: 0,
      detailScroll: 0,
      pendingG: false
    }))
  }

  function jumpToEnd() {
    setState(current => ({
      ...current,
      selectedPrIndex: Math.max(0, filterPrs(current.prs, current.search).length - 1),
      detailScroll: 0,
      pendingG: false
    }))
  }

  function scrollDetail(delta: number) {
    setState(current => ({
      ...current,
      detailScroll: clamp(current.detailScroll + delta, 0, maxDetailScroll(selectedPr, height)),
      pendingG: false
    }))
  }

  function scrollDetailToEnd() {
    setState(current => ({
      ...current,
      detailScroll: maxDetailScroll(selectedPr, height),
      pendingG: false
    }))
  }

  function setFocus(focus: FocusPane) {
    setState(current => ({ ...current, focus, pendingG: false }))
  }

  function openSelectedPr() {
    const href = selectedPr?.links?.html?.href
    if (!href) return
    openBrowser(href)
    setState(current => ({ ...current, status: `Opened #${selectedPr.id}` }))
  }

  function yankSelectedPr() {
    if (!selectedPr) return
    const text = selectedPr.links?.html?.href || `#${selectedPr.id} ${selectedPr.title}`
    const copied = copyToClipboard(text)
    setState(current => ({
      ...current,
      status: copied ? `Yanked ${text}` : 'No clipboard command found'
    }))
  }

  function refresh() {
    void loadPullRequests(state.tab, { refresh: true })
  }

  const compact = width < 110
  const detailPaneWidth = compact ? width : Math.max(30, Math.floor(width * 0.25))
  const tableWidth = Math.max(80, width - (compact ? 4 : detailPaneWidth + 8))
  const selectedDetail = selectedPr ? state.prDetails[detailKey(selectedPr)] : undefined
  const detail = renderDetail(
    selectedPr,
    selectedDetail,
    state.loadingDetailKey,
    state.detailErrorKey,
    state.detailError,
    state.detailScroll,
    detailVisibleLines(height, config.debug, state.networkRequests.length)
  )
  const debugRows = renderNetworkRequests(state.networkRequests)
  const title = state.tab === 'mine' ? 'My Pull Requests' : state.tab === 'review' ? 'Needs My Review' : 'Current Repo Pull Requests'

  return (
    <box width="100%" height="100%" flexDirection="column" backgroundColor={theme.bg}>
      <box height={4} paddingX={1} flexDirection="column">
        <text fg={theme.muted}>
          <span fg={state.tab === 'mine' ? theme.text : theme.muted} bg={state.tab === 'mine' ? theme.bluePanel : undefined}>
            {' '}
            Me (1){' '}
          </span>{' '}
          <span fg={state.tab === 'review' ? theme.text : theme.muted} bg={state.tab === 'review' ? theme.bluePanel : theme.panelAlt}>
            {' '}
            Needs Review (2){' '}
          </span>{' '}
          <span fg={state.tab === 'current' ? theme.text : theme.muted} bg={state.tab === 'current' ? theme.bluePanel : theme.panelAlt}>
            {' '}
            Current Repo (3){' '}
          </span>{' '}
          <span fg={theme.accent}>{config.pullRequestState}</span> │ Refresh (R)
        </text>
        <text fg={theme.muted}>
          {icons.search} workspace:{config.workspace}
          {currentRepoSlugs().length > 0 ? ` repo:${currentRepoSlugs().join(',')}` : ''}
        </text>
      </box>

      <box flexGrow={1} flexDirection={compact ? 'column' : 'row'}>
        <box
          flexGrow={1}
          flexDirection="column"
          borderStyle="single"
          borderColor={state.focus === 'prs' ? theme.activeBorder : theme.border}
          paddingX={1}>
          <text fg={theme.accent}>{title}</text>
          <text fg={theme.muted}>{tableHeader(tableWidth)}</text>
          {renderGroupedPrs(filteredPrs, state.selectedPrIndex, state.focus === 'prs', state.loadingPrs, tableWidth)}
        </box>

        <box
          width={compact ? '100%' : detailPaneWidth}
          flexDirection="column"
          borderStyle="single"
          borderColor={state.focus === 'detail' ? theme.activeBorder : theme.border}
          paddingX={1}>
          <text fg={theme.text}>{detail}</text>
        </box>
      </box>

      {config.debug ? (
        <box
          height={Math.min(6, Math.max(3, state.networkRequests.length + 2))}
          borderStyle="single"
          borderColor={theme.warning}
          paddingX={1}
          flexDirection="column">
          <text fg={theme.warning}>Network debug</text>
          <text fg={theme.muted}>{debugRows}</text>
        </box>
      ) : null}

      <box height={2} borderStyle="single" borderColor={state.error ? theme.danger : theme.border} paddingX={1}>
        <text fg={state.error ? theme.danger : theme.muted}>
          {state.error ?? (state.searchMode ? `/${state.search}` : state.status)} <span fg={theme.warning}>g? help</span>
        </text>
      </box>
    </box>
  )
}

function currentUserIdentity(config: AppConfig) {
  return { username: config.user, displayName: config.displayName }
}

function renderGroupedPrs(prs: PullRequest[], selected: number, active: boolean, loading: boolean, width: number) {
  if (loading) return <text fg={theme.muted}>{'\nLoading...'}</text>
  if (prs.length === 0) return <text fg={theme.muted}>{'\nNo open pull requests'}</text>

  let rowIndex = 0
  return groupPrsByRepo(prs).map(group => (
    <box key={group.repo} flexDirection="column">
      <text fg={theme.repoHeading}>{`${icons.repo}  ${group.repo}`}</text>
      <text fg={theme.subtle}>{'─'.repeat(width)}</text>
      {group.prs.map(pr => {
        const index = rowIndex++
        const selectedRow = index === selected
        return (
          <text key={`${group.repo}-${pr.id}`} fg={selectedRow ? theme.text : theme.muted} bg={selectedRow ? theme.panelAlt : undefined}>
            {tableRow(pr, selectedRow ? (active ? '▌' : '│') : ' ', width)}
          </text>
        )
      })}
      <text fg={theme.muted}> </text>
    </box>
  ))
}

function tableHeader(width: number): string {
  const columns = tableColumns(width)
  return [
    cell('', columns.cursor),
    cell('PR', columns.title),
    cell(icons.comments, columns.comments, 'right'),
    cell(icons.checks, columns.tasks, 'right'),
    cell(`${icons.user} Author`, columns.author),
    cell(`${icons.branch} Branch`, columns.branch),
    cell(icons.calendar, columns.created, 'right'),
    cell(icons.clock, columns.updated, 'right')
  ].join(' ')
}

function tableRow(pr: PullRequest, cursor: string, width: number): string {
  const columns = tableColumns(width)
  const title = `#${pr.id} ${pr.title}`
  const author = pr.author?.display_name || pr.author?.username || 'unknown'
  const branch = `${branchName(pr.source) || 'unknown'} → ${branchName(pr.destination) || 'master'}`

  return [
    cell(`${cursor} ${icons.pr}`, columns.cursor),
    cell(title, columns.title),
    cell(String(pr.comment_count ?? 0), columns.comments, 'right'),
    cell(String(pr.task_count ?? 0), columns.tasks, 'right'),
    cell(author, columns.author),
    cell(branch, columns.branch),
    cell(formatAge(pr.created_on), columns.created, 'right'),
    cell(formatAge(pr.updated_on), columns.updated, 'right')
  ].join(' ')
}

function tableColumns(width: number) {
  const fixed = {
    cursor: 3,
    comments: 4,
    tasks: 6,
    created: 8,
    updated: 8
  }
  const gaps = 7
  const fluid = Math.max(40, width - fixed.cursor - fixed.comments - fixed.tasks - fixed.created - fixed.updated - gaps)
  const author = Math.max(16, Math.floor(fluid * 0.2))
  const branch = Math.max(24, Math.floor(fluid * 0.35))
  const title = Math.max(24, fluid - author - branch)

  return { ...fixed, title, author, branch }
}

function cell(value: string, width: number, align: 'left' | 'right' = 'left'): string {
  const text = truncate(value, width)
  return align === 'right' ? text.padStart(width) : text.padEnd(width)
}

function renderDetail(
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

function firstLine(value?: string): string {
  return (value || '').split('\n')[0] || 'No message'
}

function displayAccount(account: PullRequest['author']): string {
  return account?.display_name || account?.nickname || account?.username || 'unknown'
}

function filterPrs(prs: PullRequest[], search: string): PullRequest[] {
  const query = search.trim().toLowerCase()
  if (!query) return prs

  return prs.filter(pr => {
    const haystack = [pr.title, pr.description, pr.author?.display_name, pr.author?.username, repoName(pr), String(pr.id)]
      .join(' ')
      .toLowerCase()
    return haystack.includes(query)
  })
}

function branchName(ref: PullRequest['source']): string {
  return ref?.branch?.name || ref?.name || ''
}

function repoName(pr: PullRequest | undefined): string {
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

function prRepoSlug(pr: PullRequest): string {
  const repo = pr.destination?.repository || pr.source?.repository
  if (repo?.slug) return repo.slug
  const fullName = repo?.full_name
  return fullName?.includes('/') ? fullName.split('/').pop() || '' : ''
}

function detailKey(pr: PullRequest): string {
  return `${repoName(pr)}#${pr.id}`
}

function groupPrsByRepo(prs: PullRequest[]): Array<{ repo: string; prs: PullRequest[] }> {
  const groups = new Map<string, PullRequest[]>()
  for (const pr of prs) {
    const repo = repoName(pr)
    groups.set(repo, [...(groups.get(repo) ?? []), pr])
  }
  return [...groups.entries()].map(([repo, prs]) => ({ repo, prs }))
}

function flattenGroupedPrs(prs: PullRequest[]): PullRequest[] {
  return groupPrsByRepo(prs).flatMap(group => group.prs)
}

function detailVisibleLines(height: number, debug: boolean, networkRequestCount: number): number {
  const debugHeight = debug ? Math.min(6, Math.max(3, networkRequestCount + 2)) : 0
  return Math.max(4, height - debugHeight - 10)
}

function maxDetailScroll(pr: PullRequest | undefined, height: number): number {
  if (!pr) return 0
  const descriptionLines = (pr.description?.trim() || 'No description').split('\n').length
  return Math.max(0, 80 + descriptionLines - detailVisibleLines(height, false, 0))
}

function compareUpdatedDesc(a: PullRequest, b: PullRequest): number {
  return new Date(b.updated_on ?? 0).getTime() - new Date(a.updated_on ?? 0).getTime()
}

function renderNetworkRequests(requests: NetworkRequestLog[]): string {
  if (requests.length === 0) return 'No requests yet'

  return requests
    .map(request => {
      const time = request.timestamp.toLocaleTimeString(undefined, {
        hour12: false
      })
      const status = request.cached ? 'CACHE' : request.status
      return `${time} ${request.method} ${status} ${request.durationMs}ms ${request.url}`
    })
    .join('\n')
}

function formatDate(value?: string): string {
  if (!value) return 'unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatAge(value?: string): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  const units: Array<[number, string]> = [
    [60 * 60 * 24 * 365, 'y'],
    [60 * 60 * 24 * 30, 'mo'],
    [60 * 60 * 24 * 7, 'w'],
    [60 * 60 * 24, 'd'],
    [60 * 60, 'h'],
    [60, 'm']
  ]

  for (const [size, suffix] of units) {
    if (seconds >= size) return `${Math.floor(seconds / size)}${suffix}`
  }

  return 'now'
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(max, Math.max(min, value))
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
