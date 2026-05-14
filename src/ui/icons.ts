export type IconSet = {
  bitbucket: string
  repo: string
  pr: string
  branch: string
  comments: string
  checks: string
  calendar: string
  clock: string
  user: string
  search: string
  refresh: string
  dot: string
}

const nerdFontIcons: IconSet = {
  bitbucket: '',
  repo: '',
  pr: '',
  branch: '',
  comments: '',
  checks: '',
  calendar: '',
  clock: '',
  user: '',
  search: '',
  refresh: '󰑐',
  dot: '●'
}

const fallbackIcons: IconSet = {
  bitbucket: 'BB',
  repo: 'repo',
  pr: 'PR',
  branch: 'branch',
  comments: 'comments',
  checks: 'checks',
  calendar: 'created',
  clock: 'updated',
  user: 'user',
  search: '/',
  refresh: 'r',
  dot: '•'
}

export function getIcons(): IconSet {
  const override = Bun.env.LAZY_BB_NERD_FONT?.trim()
  if (override === '0' || override === 'false') return fallbackIcons

  return nerdFontIcons
}
