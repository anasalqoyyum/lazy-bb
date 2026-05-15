import type { PullRequest } from '../bitbucket/models'
import { formatAge, spinnerChar, truncate } from './format'
import { getIcons } from './icons'
import { branchName, groupPrsByRepo } from './prUtils'
import { theme } from './theme'

const icons = getIcons()

export function PullRequestTable({
  prs,
  selected,
  active,
  loading,
  width,
  spinnerFrame
}: {
  prs: PullRequest[]
  selected: number
  active: boolean
  loading: boolean
  width: number
  spinnerFrame: number
}) {
  if (loading) return <text fg={theme.muted}>{`\n${spinnerChar(spinnerFrame)} Loading…`}</text>
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

export function tableHeader(width: number): string {
  const columns = tableColumns(width)
  return [
    cell('', columns.cursor),
    cell('PR', columns.title),
    cell(icons.comments, columns.comments),
    cell(icons.checks, columns.tasks),
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
    cell(String(pr.comment_count ?? 0), columns.comments),
    cell(String(pr.task_count ?? 0), columns.tasks),
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
    tasks: 4,
    created: 8,
    updated: 8
  }
  const gaps = 7
  const fluid = Math.max(40, width - fixed.cursor - fixed.comments - fixed.tasks - fixed.created - fixed.updated - gaps)
  const author = Math.max(16, Math.floor(fluid * 0.2))
  const branch = Math.max(20, Math.floor(fluid * 0.3))
  const title = Math.max(28, fluid - author - branch)

  return { ...fixed, title, author, branch }
}

function cell(value: string, width: number, align: 'left' | 'right' = 'left'): string {
  const text = truncate(value, width)
  return align === 'right' ? text.padStart(width) : text.padEnd(width)
}
