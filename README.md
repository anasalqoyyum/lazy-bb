# lazy-bb - Bitbucket PR TUI

A terminal user interface (TUI) for browsing Bitbucket pull requests built with [Bubble Tea](https://github.com/charmbracelet/bubbletea) and the Charm framework.

## Features

- **List all pull requests** - Displays PRs from your Bitbucket repository
- **Navigate with arrow keys** - Smooth up/down navigation through the PR list
- **Side-by-side view** - PR list on the left, detailed view on the right
- **Color-coded status** - Visual indicators for PR states (OPEN, MERGED, DECLINED)
- **Open in browser** - Press Enter to open PR in your default browser
- **API token authentication** - Secure Bitbucket API access via environment variables

## Setup

### Prerequisites

- Go 1.24+
- Bitbucket API token

### Installation

```bash
go install github.com/anasalqoyyum/lazy-bb@latest
```

### Configuration

Set the following environment variables:

```bash
export BITBUCKET_TOKEN=your_api_token_here
export BITBUCKET_WORKSPACE=your_workspace
export BITBUCKET_REPO=your_repository
```

**OR** create a `.env` file in the project directory:

```bash
# .env
BITBUCKET_TOKEN=your_api_token_here
BITBUCKET_WORKSPACE=your_workspace
BITBUCKET_REPO=your_repository
```

The app will automatically load from `.env` if it exists.

**Getting your Bitbucket API token:**

1. Go to <https://bitbucket.org/account/settings/app-passwords/>
2. Click "Create app password"
3. Give it a name and select at least "pullrequest:read" scope
4. Copy the generated token

## Usage

Run the app:

```bash
lazy-bb
```

### Keyboard Controls

| Key                  | Action                     |
| -------------------- | -------------------------- |
| `↑` or `k`           | Move up in PR list         |
| `↓` or `j`           | Move down in PR list       |
| `Enter`              | Open PR in default browser |
| `q`, `Esc`, `Ctrl+C` | Quit application           |

## Project Structure

```
lazy-bb/
├── main.go              # Main application and tea.Model
├── config.go            # Configuration management
├── client.go            # Bitbucket API client
├── models.go            # Data structures for PR objects
├── internals/
│   ├── list.go          # PR list component (left panel)
│   └── detail.go        # PR detail component (right panel)
└── utils/
    └── browser.go       # Browser launching utility
```

## Architecture

The app uses the Bubble Tea architecture with custom components:

- **List Component** (`internals/list.go`) - Manages PR list navigation and rendering
- **Detail Component** (`internals/detail.go`) - Displays selected PR details
- **API Client** (`client.go`) - Handles Bitbucket REST API calls
- **Config** (`config.go`) - Loads and validates environment variables

## Layout

```
┌────────────────────────────────────────────────────────────┐
│ #1   feat: Add new feature                    [OPEN]       │
│ #2   fix: Bug fix                             [MERGED]     │
│ #3   chore: Update deps                       [DECLINED]   │ PR List
│                                                             │
│ [1/3] Use ↑↓ to navigate, Enter to open, q to quit        │
├──────────────────────────┬──────────────────────────────────┤
│ Title                    │ Title                             │
│   feat: Add new feature  │ PR #1 - [OPEN]                   │
│                          │                                   │
│ Author                   │ Author                            │
│   John Doe               │ John Doe                          │
│                          │                                   │
│ Dates                    │ Dates                             │
│   Created: 2024-01-15    │ Created: 2024-01-15 10:30        │
│   Updated: 2024-01-16    │ Updated: 2024-01-16 14:45        │
│                          │                                   │
│ Description              │ Description                       │
│   This PR adds...        │ This PR implements the new        │
│                          │ feature requested in the issue.   │
│ Link                     │ It also refactors...              │
│   [bitbucket.org/...]    │                                   │
│                          │ Link                              │
│                          │ https://bitbucket.org/...         │
└──────────────────────────┴──────────────────────────────────┘
```

## Dependencies

- `github.com/charmbracelet/bubbles` - Reusable components
- `github.com/charmbracelet/bubbletea` - TUI framework
- `github.com/charmbracelet/lipgloss` - Styling and layout

## Notes

- PR list auto-loads on startup
- Cursor position is reset when switching repositories
- Browser opening may require OS-specific setup on headless servers
- Bitbucket API pagination is handled automatically (first 30 PRs by default)

## Troubleshooting

**"missing required environment variables"**

- Ensure `BITBUCKET_TOKEN`, `BITBUCKET_WORKSPACE`, and `BITBUCKET_REPO` are set

**"API returned status 401"**

- Check your API token is valid and has "pullrequest:read" permissions

**"failed to open browser"**

- On Linux, ensure `xdg-open` is installed
- On macOS, ensure `open` command is available
- On Windows, ensure `rundll32` is available
- as a note, only tested on WSL and macOS
