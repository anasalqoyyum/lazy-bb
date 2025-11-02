# lazy-bb - Bitbucket PR TUI

A terminal user interface (TUI) for browsing Bitbucket pull requests built with [Bubble Tea](https://github.com/charmbracelet/bubbletea) and the Charm framework.

## Features

- **List all pull requests** - Displays PRs from your Bitbucket repository in a table format
- **Color-coded status** - Visual indicators for PR states (OPEN, MERGED, DECLINED)
- **Open in browser** - Press Enter to open PR in your default browser
- **Rich markdown rendering** - Description formatted with glow for better readability

## Setup

### Prerequisites

- Go 1.24+
- Bitbucket email address
- Bitbucket app password

### Installation

```bash
go install github.com/anasalqoyyum/lazy-bb@latest
```

### Configuration

Set the following environment variables:

```bash
export BITBUCKET_EMAIL=your_bitbucket_email@example.com
export BITBUCKET_TOKEN=your_app_password_here
export BITBUCKET_WORKSPACE=your_workspace
export BITBUCKET_REPO=your_repository
```

**OR** create a `.env` file in the project directory:

```bash
# .env
BITBUCKET_EMAIL=your_bitbucket_email@example.com
BITBUCKET_TOKEN=your_app_password_here
BITBUCKET_WORKSPACE=your_workspace
BITBUCKET_REPO=your_repository
```

The app will automatically load from `.env` if it exists.

**Getting your Bitbucket app password:**

1. Go to <https://id.atlassian.com/manage-profile/security/api-tokens>
2. Click "Create app password"
3. Give it a name and select at least "read:repository:bitbucket" scope
4. Copy the generated token and use it as your `BITBUCKET_TOKEN`
5. Use your Bitbucket email address as `BITBUCKET_EMAIL`

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

## Rendering

### Markdown Support

PR descriptions are rendered as formatted markdown using [Glamour](https://github.com/charmbracelet/glamour):

- Syntax highlighting for code blocks
- Proper formatting for lists, bold, italic, etc.
- Automatic word wrapping to fit terminal width
- Fallback to plain text if markdown parsing fails

## Project Structure

```
lazy-bb/
├── cmd/
│   └── lazy-bb/
│       └── main.go              # Application entry point
├── internal/
│   ├── api/
│   │   ├── client.go            # Bitbucket API client
│   │   └── models.go            # Data structures for PR objects
│   ├── config/
│   │   └── config.go            # Configuration management
│   ├── ui/
│   │   ├── list.go              # PR list component (left panel)
│   │   └── detail.go            # PR detail component (right panel)
│   └── utils/
│       └── browser.go           # Browser launching utility
└── Makefile                     # Build targets
```

## Architecture

The app uses the Bubble Tea architecture with organized internal packages:

- **API Package** (`internal/api/`) - Handles Bitbucket REST API calls and data models
- **UI Package** (`internal/ui/`) - Manages PR list navigation and detail rendering
- **Config Package** (`internal/config/`) - Loads and validates environment variables
- **Utils Package** (`internal/utils/`) - Helper utilities (browser launcher)

## Layout

The TUI uses a full-screen 50:50 split layout:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ PR# │ Title                  │ Author       │ State   │ Workspace/Repo       │
├─────┼────────────────────────┼──────────────┼─────────┼──────────────────────┤
│ #1  │ feat: Add new feature  │ John Doe     │ OPEN    │ my-workspace/my-repo │ PR List (50%)
│ #2  │ fix: Bug fix           │ Jane Smith   │ MERGED  │ my-workspace/my-repo │
│ #3  │ chore: Update deps     │ Bob Johnson  │ DECLINED│ my-workspace/my-repo │
│ [1/3] Use ↑↓ to navigate, Enter to open, q to quit                          │
├──────────────────────────────────────────────────────────────────────────────┤
│ Title                                                                         │
│   feat: Add new feature                                                      │
│                                                                               │
│ PR #1 - OPEN                                                                 │
│                                                                               │ PR Details (50%)
│ Author                                                                        │
│   John Doe                                                                   │
│                                                                               │
│ Repository                                                                    │
│   my-workspace/my-repo                                                       │
│                                                                               │
│ Description (rendered as markdown)                                            │
│   This PR adds the new feature...                                            │
│                                                                               │
│ Link                                                                          │
│   https://bitbucket.org/...                                                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Features:**

- **PR Table Columns**: PR# | Title | Author | State | Workspace/Repo
- **Color-coded States**: Green (OPEN), Purple (MERGED), Red (DECLINED)
- **Responsive Design**: Automatically adapts to terminal width/height
- **Selected Row Highlight**: Blue background on current selection
- **Markdown Rendering**: PR descriptions are formatted with syntax highlighting
- **Full Terminal Utilization**: Maximizes available screen space

## Dependencies

- `github.com/charmbracelet/bubbles` - Reusable components
- `github.com/charmbracelet/bubbletea` - TUI framework
- `github.com/charmbracelet/lipgloss` - Styling and layout
- `github.com/charmbracelet/glamour` - Markdown rendering

## Notes

- PR list auto-loads on startup
- Cursor position is reset when switching repositories
- Browser opening may require OS-specific setup on headless servers
- Bitbucket API pagination is not handled yet (first 30 PRs by default)

## Troubleshooting

**"missing required environment variables"**

- Ensure `BITBUCKET_EMAIL`, `BITBUCKET_TOKEN`, `BITBUCKET_WORKSPACE`, and `BITBUCKET_REPO` are set

**"API returned status 401"**

- Check your email and app password are correct
- Verify the app password has "pullrequest:read" permissions

**"failed to open browser"**

- On Linux, ensure `xdg-open` is installed
- On macOS, ensure `open` command is available
- On Windows, ensure `rundll32` is available
- As a note, only tested on WSL and macOS
