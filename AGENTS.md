# lazybb OpenTUI Implementation Guide

This repository is an OpenTUI/Bun TypeScript app.

## Primary stack

- Runtime: Bun
- TUI: OpenTUI
- UI binding: `@opentui/react`
- Language: TypeScript
- Bitbucket target: Bitbucket Cloud first

## Important commands

Allowed validation command:

```bash
bunx tsc --noEmit
```

Do not run start/dev commands unless the user explicitly asks:

```bash
bun src/main.tsx
bun run start
```

Do not run build/bundle/release commands unless explicitly requested.

## Environment variables

The OpenTUI implementation uses:

- `BKT_USER`
- `BKT_TOKEN`
- `BKT_WORKSPACE`
- optional `BKT_REPO`, single slug or comma-separated slugs
- optional `BKT_REPOS`, comma-separated repository filter
- optional `BKT_FILTER`, e.g. `workspace:team repo:repo-a,repo-b is:open`
- optional `BKT_PR_STATE`, default `OPEN`
- optional `BKT_CACHE_TTL`, seconds, default `300`
- optional `BKT_DEBUG` / `LAZY_BB_DEBUG`, `1` or `0`
- optional `LAZY_BB_NERD_FONT`, `1` or `0`

Do not reintroduce the old Go env names as the primary API.

## Caching requirement

Bitbucket API calls should use an in-memory cache by request URL.

- Default TTL: 300 seconds
- Configurable with `BKT_CACHE_TTL`
- `BKT_CACHE_TTL=0` disables caching
- Manual refresh must bypass cache

Avoid making API requests on every navigation event.

## Repository filter requirement

When `BKT_REPOS`, comma-separated `BKT_REPO`, or `repo:` in `BKT_FILTER` is configured, do not call the full repository-list endpoint. Only load the configured repo slugs.

Supported filter expression example:

```text
workspace:accelbyte repo:internal-customer-portal,justice-odin is:open
```

## Network debug requirement

When `--debug`, `BKT_DEBUG=1`, or `LAZY_BB_DEBUG=1` is enabled, show recent network requests in a bottom TUI panel.

The panel should include:

- method
- status or cache hit
- duration
- URL

Do not log credentials or authorization headers.

## UI requirements

- Keep vim-like keybindings as the primary interaction model.
- Help text should advertise vim keys first.
- Arrow keys may exist as aliases but should not be the main documented path.
- Use `gh-dash` and `atlas.nvim` as design inspiration.
- Keep the UI compact, readable, and keyboard-first.
- Use Nerd Font icons only through `src/ui/icons.ts`.
- Always provide plain text fallbacks for icons.

## Current OpenTUI structure

```text
src/
  main.tsx
  config.ts
  bitbucket/
    client.ts
    models.ts
  git/
    remote.ts
  ui/
    App.tsx
    SetupError.tsx
    browser.ts
    icons.ts
    theme.ts
```

## Config behavior

Config resolution should follow this order:

1. Explicit env vars
2. `.env`
3. Git remote fallback for workspace/repo

Supported Cloud remote examples:

```text
git@bitbucket.org:workspace/repo.git
https://bitbucket.org/workspace/repo.git
```

Explicit environment variables must always win over inferred git remote values.

## Code style

- Prefer simple TypeScript modules over premature abstractions.
- Keep state cohesive and readable.
- Avoid unnecessary `useMemo`.
- Do not add comments unless they explain a non-obvious decision.
- Keep UI components small when the main app grows.
- Handle expected failures clearly in the TUI instead of crashing.

## Generated/install artifacts

Do not edit generated or installed artifacts.

Ignored artifacts include:

- `node_modules/`
- `dist/`
- `.env`

Do not commit secrets or local credentials.

## Validation before handing off

Run:

```bash
bunx tsc --noEmit
```

If typecheck fails, either fix it or clearly report the failure and blocker.
