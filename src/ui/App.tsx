import { useKeyboard, useRenderer, useTerminalDimensions } from '@opentui/react'
import { useEffect, useRef, useState } from 'react'
import { BitbucketClient, BitbucketHttpError, type BitbucketUserIdentity, type NetworkRequestLog } from '../bitbucket/client'
import type { PullRequest, PullRequestDetail } from '../bitbucket/models'
import type { AppConfig } from '../config'
import { openBrowser } from './browser'
import { copyToClipboard } from './clipboard'
import { renderDetail, detailVisibleLines, maxDetailScroll } from './detail'
import { clamp, errorMessage } from './format'
import { getIcons } from './icons'
import { renderNetworkRequests } from './networkDebug'
import {
  compareUpdatedDesc,
  currentRepoSlugs,
  currentUserIdentity as configuredUserIdentity,
  detailKey,
  filterPrs,
  flattenGroupedPrs,
  prRepoSlug,
  repoName,
  tabLabel,
  tabTitle,
  type FocusPane,
  type PrTab
} from './prUtils'
import { PullRequestTable, tableHeader } from './table'
import { theme } from './theme'

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
  detailPaneVisible: boolean
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
    detailPaneVisible: true,
    detailScroll: 0,
    prDetails: {},
    networkRequests: []
  })

  const loadRequestId = useRef(0)
  const userIdentity = useRef<BitbucketUserIdentity | undefined>(undefined)
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
    if (!selectedPr || !state.detailPaneVisible) return
    void loadPullRequestDetail(selectedPr)
  }, [selectedPr?.id, repoName(selectedPr), state.detailPaneVisible])

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
        status: 'j/k move · h/l panes · p detail · 1 me · 2 repo · gg/G top/bottom · / search · r refresh · o open · y yank · q quit'
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
        if (state.detailPaneVisible) setFocus('detail')
        break
      case 'p':
        toggleDetailPane()
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
        void loadPullRequests('current')
        break
    }
  })

  async function loadPullRequests(tab: PrTab, options: { refresh?: boolean } = {}) {
    const requestId = ++loadRequestId.current
    const repoSlugs = currentRepoSlugs(config)
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
      setState(current => {
        if (requestId !== loadRequestId.current || current.tab !== tab) return current

        return {
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
        }
      })
    } catch (error) {
      handlePullRequestLoadError(error, requestId, tab, label)
    }
  }

  async function loadTabPullRequests(tab: PrTab, repoSlugs: string[], options: { refresh?: boolean }): Promise<PullRequest[]> {
    if (tab === 'mine') return client.listMyPullRequests((await resolveUserIdentity(options)).username, config.pullRequestState, options)

    if (repoSlugs.length === 0) return []

    const lists = await Promise.all(
      repoSlugs.map(async slug => {
        try {
          return await client.listPullRequests(slug, config.pullRequestState, options)
        } catch (error) {
          if (error instanceof BitbucketHttpError && error.status === 404) return []
          throw error
        }
      })
    )
    return lists.flat().sort(compareUpdatedDesc)
  }

  async function resolveUserIdentity(options: { refresh?: boolean }) {
    if (!options.refresh && userIdentity.current) return userIdentity.current

    try {
      userIdentity.current = await client.currentUserIdentity(options)
    } catch (error) {
      if (config.user.includes('@')) throw error
      userIdentity.current = configuredUserIdentity(config)
    }
    return userIdentity.current
  }

  function handlePullRequestLoadError(error: unknown, requestId: number, tab: PrTab, label: string) {
    if (error instanceof BitbucketHttpError && error.status === 404) {
      setState(current => {
        if (requestId !== loadRequestId.current || current.tab !== tab) return current

        return {
          ...current,
          prs: [],
          selectedPrIndex: 0,
          loadingPrs: false,
          error: undefined,
          status: tab === 'mine' ? 'No pull requests found for this account' : `No pull requests found for ${label}`
        }
      })
      return
    }

    setState(current => {
      if (requestId !== loadRequestId.current || current.tab !== tab) return current

      return {
        ...current,
        loadingPrs: false,
        error: errorMessage(error),
        status: 'Pull request load failed'
      }
    })
  }

  async function loadPullRequestDetail(pr: PullRequest, options: { refresh?: boolean } = {}) {
    if (!state.detailPaneVisible) return

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
    setState(current => ({ ...current, selectedPrIndex: 0, detailScroll: 0, pendingG: false }))
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
    setState(current => ({ ...current, detailScroll: maxDetailScroll(selectedPr, height), pendingG: false }))
  }

  function setFocus(focus: FocusPane) {
    setState(current => ({ ...current, focus, pendingG: false }))
  }

  function toggleDetailPane() {
    setState(current => ({
      ...current,
      detailPaneVisible: !current.detailPaneVisible,
      focus: current.detailPaneVisible && current.focus === 'detail' ? 'prs' : current.focus,
      pendingG: false,
      status: current.detailPaneVisible ? 'Detail pane hidden' : 'Detail pane shown'
    }))
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
    if (selectedPr && state.detailPaneVisible) {
      const key = detailKey(selectedPr)
      setState(current => {
        const prDetails = { ...current.prDetails }
        delete prDetails[key]
        return { ...current, prDetails }
      })
      void loadPullRequestDetail(selectedPr, { refresh: true })
    }

    void loadPullRequests(state.tab, { refresh: true })
  }

  const compact = width < 110
  const repoSlugs = currentRepoSlugs(config)
  const detailPaneWidth = state.detailPaneVisible ? (compact ? width : Math.max(30, Math.floor(width * 0.25))) : 0
  const tableWidth = Math.max(80, width - (compact || !state.detailPaneVisible ? 4 : detailPaneWidth + 8))
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

  return (
    <box width="100%" height="100%" flexDirection="column" backgroundColor={theme.bg}>
      <box height={4} paddingX={1} flexDirection="column">
        <text fg={theme.muted}>
          <span fg={state.tab === 'mine' ? theme.text : theme.muted} bg={state.tab === 'mine' ? theme.bluePanel : undefined}>
            {' '}
            Me (1){' '}
          </span>{' '}
          <span fg={state.tab === 'current' ? theme.text : theme.muted} bg={state.tab === 'current' ? theme.bluePanel : theme.panelAlt}>
            {' '}
            Pull Requests (2){' '}
          </span>{' '}
          <span fg={theme.accent}>{config.pullRequestState}</span> │ Refresh (R)
        </text>
        <text fg={theme.muted}>
          {icons.search} workspace:{config.workspace}
          {repoSlugs.length > 0 ? ` repo:${repoSlugs.join(',')}` : ''}
        </text>
      </box>

      <box flexGrow={1} flexDirection={compact ? 'column' : 'row'}>
        <box
          flexGrow={1}
          flexDirection="column"
          borderStyle="single"
          borderColor={state.focus === 'prs' ? theme.activeBorder : theme.border}
          paddingX={1}>
          <text fg={theme.accent}>{tabTitle(state.tab)}</text>
          <text fg={theme.muted}>{tableHeader(tableWidth)}</text>
          <PullRequestTable
            prs={filteredPrs}
            selected={state.selectedPrIndex}
            active={state.focus === 'prs'}
            loading={state.loadingPrs}
            width={tableWidth}
          />
        </box>

        {state.detailPaneVisible ? (
          <box
            width={compact ? '100%' : detailPaneWidth}
            flexDirection="column"
            borderStyle="single"
            borderColor={state.focus === 'detail' ? theme.activeBorder : theme.border}
            paddingX={1}>
            <text fg={theme.text}>{detail}</text>
          </box>
        ) : null}
      </box>

      {config.debug ? (
        <box
          height={Math.min(6, Math.max(3, state.networkRequests.length + 2))}
          borderStyle="single"
          borderColor={theme.warning}
          paddingX={1}
          flexDirection="column">
          <text fg={theme.warning}>Network debug</text>
          <text fg={theme.muted}>{renderNetworkRequests(state.networkRequests)}</text>
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
