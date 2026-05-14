export type Link = {
  href: string
}

export type Links = {
  html?: Link
  self?: Link
  merge?: Link
  commits?: Link
  approve?: Link
  "request-changes"?: Link
  diff?: Link
  diffstat?: Link
  comments?: Link
  activity?: Link
  statuses?: Link
}

export type Account = {
  username?: string
  display_name?: string
  nickname?: string
  uuid?: string
  account_id?: string
}

export type Repository = {
  slug: string
  name: string
  full_name?: string
  links?: Links
}

export type BranchRef = {
  name?: string
  branch?: { name?: string }
  repository?: Repository
}

export type CommitRef = {
  hash?: string
}

export type PullRequest = {
  id: number
  title: string
  description?: string
  state: string
  author?: Account
  reviewers?: Account[]
  participants?: PullRequestParticipant[]
  comment_count?: number
  task_count?: number
  source?: BranchRef & { commit?: CommitRef }
  destination?: BranchRef & { commit?: CommitRef }
  created_on?: string
  updated_on?: string
  links?: Links
}

export type PullRequestParticipant = {
  role?: string
  state?: string
  user?: Account
}

export type PullRequestCommit = {
  hash: string
  message?: string
  date?: string
  author?: {
    raw?: string
    user?: Account
  }
  links?: Links & { statuses?: Link }
}

export type PullRequestDiffstat = {
  status?: string
  lines_added?: number
  lines_removed?: number
  old?: { path?: string }
  new?: { path?: string }
}

export type PullRequestActivity = {
  update?: {
    date?: string
    author?: Account
    source?: BranchRef
    destination?: BranchRef
  }
  approval?: {
    date?: string
    user?: Account
  }
  comment?: PullRequestComment
}

export type PullRequestComment = {
  id: number
  user?: Account
  content?: { raw?: string }
  created_on?: string
  updated_on?: string
  deleted?: boolean
  parent?: { id?: number }
  inline?: {
    path?: string
    from?: number
    to?: number
  }
}

export type PullRequestTask = {
  id: number
  state?: string
  content?: { raw?: string }
  created_on?: string
  updated_on?: string
  resolved_on?: string
  creator?: Account
  comment?: { id?: number }
}

export type CommitStatus = {
  key?: string
  name?: string
  state?: string
  url?: string
}

export type PullRequestDetail = {
  pr: PullRequest
  commits: PullRequestCommit[]
  diffstat: PullRequestDiffstat[]
  activity: PullRequestActivity[]
  statuses: CommitStatus[]
  comments: PullRequestComment[]
  tasks: PullRequestTask[]
}

export type Page<T> = {
  pagelen?: number
  page?: number
  size?: number
  next?: string
  previous?: string
  values: T[]
}
