# lazybb - Simple Bitbucket PR TUI

`lazybb` is a keyboard-first Bitbucket Cloud terminal UI built with [OpenTUI](https://opentui.dev/). It is designed for quickly browsing repositories and open pull requests without living inside a browser.

The current implementation is an OpenTUI/Bun inspired by `gh-dash`.

## Features

- Browse Bitbucket Cloud repositories in a workspace
- Browse open pull requests for the selected repository
- View pull request metadata and descriptions
- Open the selected pull request in your browser
- Vim-like keybindings
- Optional Nerd Font icons with plain-text fallback
- In-memory API caching to avoid hitting Bitbucket on every interaction
- Workspace/repo fallback detection from local Bitbucket git remotes

## Prerequisites

- [Bun](https://bun.sh/) installed
- Bitbucket Cloud account
- Bitbucket API token
- A terminal supported by OpenTUI
- Optional: Nerd Font for richer icons

## Bitbucket token

Create a Bitbucket Cloud API token from Atlassian account settings:

1. Open <https://id.atlassian.com/manage-profile/security/api-tokens>
2. Create a Bitbucket-scoped token
3. Grant at least repository and pull request read access
4. Copy the token immediately

Use your Atlassian account email or Bitbucket-compatible username as `BKT_USER`.

## Configuration

Required environment variables:

```bash
export BKT_USER="you@example.com"
export BKT_TOKEN="your-bitbucket-token"
export BKT_WORKSPACE="your-workspace"
```

Optional environment variables:

```bash
export BKT_REPO="default-repo-slug"
export BKT_REPOS="repo-a,repo-b"
export BKT_FILTER="workspace:your-workspace repo:repo-a,repo-b is:open"
export BKT_CACHE_TTL="300"
export BKT_DEBUG="1"
export LAZY_BB_NERD_FONT="1"
```

| Variable                      | Description                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| `BKT_USER`                    | Bitbucket Basic Auth username/email                                                                    |
| `BKT_TOKEN`                   | Bitbucket API token                                                                                    |
| `BKT_WORKSPACE`               | Bitbucket Cloud workspace                                                                              |
| `BKT_REPO`                    | Optional default repository slug. Can be comma-separated                                               |
| `BKT_REPOS`                   | Optional comma-separated repository filter. When set, `lazybb` does not fetch the full repository list |
| `BKT_FILTER`                  | Optional gh-dash-like filter: `workspace:team repo:repo-a,repo-b is:open`                              |
| `BKT_PR_STATE`                | Optional pull request state. Defaults to `OPEN`                                                        |
| `BKT_CACHE_TTL`               | Cache TTL in seconds. Defaults to `300`. Use `0` to disable caching                                    |
| `BKT_DEBUG` / `LAZY_BB_DEBUG` | Show network requests in a debug panel at the bottom of the TUI                                        |
| `LAZY_BB_NERD_FONT`           | Optional icon override. `1` enables Nerd Font icons, `0` forces text fallback                          |

You can also create a local `.env` file:

```bash
BKT_USER=you@example.com
BKT_TOKEN=your-bitbucket-token
BKT_WORKSPACE=your-workspace
BKT_CACHE_TTL=300
```

`.env` is ignored by git.

## Repository filtering

To avoid fetching every repository in a workspace, configure a repository filter:

```bash
export BKT_REPOS="internal-customer-portal,internal-customer-database-integration,justice-odin"
```

Or use the filter expression form:

```bash
export BKT_FILTER="workspace:accelbyte repo:internal-customer-portal,internal-customer-database-integration,justice-odin is:open"
```

When `BKT_REPOS`, comma-separated `BKT_REPO`, or `repo:` in `BKT_FILTER` is set, `lazybb` skips the full repository-list endpoint and only loads those repositories.

## Workspace/repo auto-detection

If `BKT_WORKSPACE` or `BKT_REPO` is missing, `lazybb` attempts to infer them from `git remote -v`.

Supported Bitbucket Cloud remote examples:

```text
git@bitbucket.org:workspace/repo.git
https://bitbucket.org/workspace/repo.git
```

Explicit environment variables always win over inferred values.

## Install dependencies

```bash
bun install
```

## Run

```bash
bun src/main.tsx
```

Or use the package script:

```bash
bun run start
```

## Compile locally and add to PATH

Build a local standalone executable with Bun:

```bash
bun build --compile src/main.tsx --outfile lazybb
```

Move it to a directory that is already on your `PATH`:

```bash
mkdir -p ~/.local/bin
mv lazybb ~/.local/bin/lazybb
```

If `~/.local/bin` is not on your `PATH`, add it to your shell profile:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Then reload your shell and run:

```bash
lazybb
```

Enable the network debug panel with either an environment variable or CLI flag:

```bash
BKT_DEBUG=1 bun src/main.tsx
bun src/main.tsx --debug
```

## Typecheck

```bash
bunx tsc --noEmit
```

## Keybindings

| Key           | Action                                 |
| ------------- | -------------------------------------- |
| `q`           | Quit                                   |
| `esc`         | Cancel search/help, or quit            |
| `ctrl+c`      | Force quit                             |
| `j` / `down`  | Move down                              |
| `k` / `up`    | Move up                                |
| `h` / `left`  | Previous pane                          |
| `l` / `right` | Next pane                              |
| `gg`          | Jump to top                            |
| `G`           | Jump to bottom                         |
| `ctrl+d`      | Half-page down                         |
| `ctrl+u`      | Half-page up                           |
| `enter`       | Select repo or open PR                 |
| `o`           | Open selected PR in browser            |
| `r`           | Refresh and bypass cache               |
| `/`           | Search/filter pull requests            |
| `?`           | Show keybinding help in the status bar |
| `1`           | Focus repositories                     |
| `2`           | Focus pull requests                    |
| `3`           | Focus detail                           |

## Caching

Bitbucket API responses are cached in memory by request URL.

Default TTL: `300` seconds.

Configure with:

```bash
export BKT_CACHE_TTL=60
```

Manual refresh with `r` bypasses the cache for the current request.

## Project structure

```text
src/
  main.tsx              # OpenTUI entrypoint
  config.ts             # env/.env/git remote config resolution
  bitbucket/
    client.ts           # Bitbucket Cloud API client with cache
    models.ts           # API response types
  git/
    remote.ts           # Bitbucket remote URL parser
  ui/
    App.tsx             # Main OpenTUI React app
    SetupError.tsx      # Setup/config error screen
    browser.ts          # Browser opener
    icons.ts            # Nerd Font/fallback icons
    theme.ts            # UI colors
```

## Notes

This TUI targets Bitbucket Cloud first. Bitbucket Data Center support is not implemented in the OpenTUI UI yet.
