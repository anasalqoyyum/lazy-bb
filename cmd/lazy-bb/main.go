package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/anasalqoyyum/lazy-bb/internal/api"
	"github.com/anasalqoyyum/lazy-bb/internal/config"
	"github.com/anasalqoyyum/lazy-bb/internal/ui"
	"github.com/anasalqoyyum/lazy-bb/internal/utils"
)

type errMsg error

// statusMsg is used to update PR list
type statusMsg struct {
	prs []api.PR
}

type model struct {
	spinner  spinner.Model
	quitting bool
	err      error
	loading  bool
	client   *api.Client
	prList   *ui.PRList
	prDetail *ui.PRDetail
	width    int
	height   int
	prs      []api.PR
}

var quitKeys = key.NewBinding(
	key.WithKeys("q", "esc", "ctrl+c"),
	key.WithHelp("q/esc", "quit"),
)

var upKeys = key.NewBinding(
	key.WithKeys("up", "k"),
	key.WithHelp("↑/k", "up"),
)

var downKeys = key.NewBinding(
	key.WithKeys("down", "j"),
	key.WithHelp("↓/j", "down"),
)

var enterKeys = key.NewBinding(
	key.WithKeys("enter"),
	key.WithHelp("enter", "open in browser"),
)

var focusPRListKeys = key.NewBinding(
	key.WithKeys("1"),
	key.WithHelp("1", "focus PR list"),
)

var focusDetailKeys = key.NewBinding(
	key.WithKeys("2"),
	key.WithHelp("2", "focus detail"),
)

var refreshKeys = key.NewBinding(
	key.WithKeys("r"),
	key.WithHelp("r", "refresh PR list"),
)

var halfScrollUpKeys = key.NewBinding(
	key.WithKeys("ctrl+u"),
	key.WithHelp("ctrl+u", "half page up"),
)

var halfScrollDownKeys = key.NewBinding(
	key.WithKeys("ctrl+d"),
	key.WithHelp("ctrl+d", "half page down"),
)

func initialModel() model {
	s := spinner.New()
	s.Spinner = spinner.Dot
	s.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("#7aa2f7"))

	// Use default sizes, will be updated on first WindowSizeMsg
	halfWidth := 90
	height := 30

	return model{
		spinner:  s,
		loading:  true,
		prList:   ui.NewPRList(halfWidth, height),
		prDetail: ui.NewPRDetail(halfWidth, height),
		width:    halfWidth * 2,
		height:   height,
	}
}

func (m model) Init() tea.Cmd {
	return tea.Batch(
		m.spinner.Tick,
		fetchPRsCmd(m.client),
	)
}

// fetchPRsCmd fetches PRs from Bitbucket API
func fetchPRsCmd(client *api.Client) tea.Cmd {
	return func() tea.Msg {
		if client == nil {
			return errMsg(fmt.Errorf("client not initialized"))
		}

		prs, err := client.FetchPRs()
		if err != nil {
			return errMsg(err)
		}

		return statusMsg{prs: prs}
	}
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		// Split width 50:50 between list and detail
		halfWidth := (msg.Width - 2) / 2 // -2 for border
		m.prList.Width = halfWidth
		m.prDetail.Width = halfWidth
		m.prList.Height = msg.Height - 2 // -2 for border
		m.prDetail.Height = msg.Height - 2
		return m, nil

	case tea.KeyMsg:
		if key.Matches(msg, quitKeys) {
			m.quitting = true
			return m, tea.Quit
		}

		// Handle refresh
		if key.Matches(msg, refreshKeys) && !m.loading {
			m.loading = true
			return m, fetchPRsCmd(m.client)
		}

		// Handle focus switching
		if key.Matches(msg, focusPRListKeys) && !m.loading {
			m.prList.Focused = true
			m.prDetail.Focused = false
			return m, nil
		}

		if key.Matches(msg, focusDetailKeys) && !m.loading {
			m.prList.Focused = false
			m.prDetail.Focused = true
			return m, nil
		}

		// If list is focused, navigate through PRs
		if m.prList.Focused && !m.loading {
			if key.Matches(msg, upKeys) {
				m.prList.MoveUp()
				selected := m.prList.GetSelected()
				if selected != nil {
					m.prDetail.SetPR(selected)
				}
				return m, nil
			}

			if key.Matches(msg, downKeys) {
				m.prList.MoveDown()
				selected := m.prList.GetSelected()
				if selected != nil {
					m.prDetail.SetPR(selected)
				}
				return m, nil
			}

			if key.Matches(msg, enterKeys) {
				selected := m.prList.GetSelected()
				if selected != nil {
					if err := utils.OpenBrowser(selected.Links.HTML.Href); err != nil {
						m.err = err
					}
				}
				return m, nil
			}
		}

		// If detail is focused, scroll through content
		if m.prDetail.Focused && !m.loading {
			if key.Matches(msg, upKeys) {
				m.prDetail.ScrollUp()
				return m, nil
			}

			if key.Matches(msg, downKeys) {
				m.prDetail.ScrollDown()
				return m, nil
			}

			if key.Matches(msg, halfScrollUpKeys) {
				m.prDetail.ScrollUpHalf()
				return m, nil
			}

			if key.Matches(msg, halfScrollDownKeys) {
				m.prDetail.ScrollDownHalf()
				return m, nil
			}
		}

		return m, nil

	case statusMsg:
		m.loading = false
		m.prs = msg.prs

		// Convert PRs to internal format
		internalPRs := make([]ui.PR, len(msg.prs))
		for i, pr := range msg.prs {
			authorName := pr.Author.FullName
			if authorName == "" {
				authorName = pr.Author.Username
			}

			// Extract workspace and repo from full_name (format: workspace/repo)
			workspace := ""
			repo := ""
			if pr.Source.Repository.FullName != "" {
				parts := strings.Split(pr.Source.Repository.FullName, "/")
				if len(parts) >= 2 {
					workspace = parts[0]
					repo = parts[1]
				}
			}

			internalPRs[i] = ui.PR{
				ID:          pr.ID,
				Title:       pr.Title,
				Description: pr.Description,
				Author:      authorName,
				State:       pr.State,
				CreatedOn:   pr.CreatedOn.Format("2006-01-02 15:04"),
				UpdatedOn:   pr.UpdatedOn.Format("2006-01-02 15:04"),
				Workspace:   workspace,
				Repo:        repo,
				Links: ui.Links{
					HTML: ui.HTML{
						Href: pr.Links.HTML.Href,
					},
				},
			}
		}

		m.prList.SetPRs(internalPRs)
		if len(internalPRs) > 0 {
			m.prDetail.SetPR(&internalPRs[0])
		}
		return m, nil

	case errMsg:
		m.err = msg
		m.loading = false
		return m, nil

	default:
		if m.loading {
			var cmd tea.Cmd
			m.spinner, cmd = m.spinner.Update(msg)
			return m, cmd
		}
	}

	return m, nil
}

func (m model) View() string {
	if m.err != nil {
		return fmt.Sprintf("\n\n  Error: %s\n\n", m.err.Error())
	}

	if m.loading {
		str := fmt.Sprintf("\n\n   %s Loading pull requests... %s\n\n", m.spinner.View(), quitKeys.Help().Desc)
		if m.quitting {
			return str + "\n"
		}
		return str
	}

	// Side-by-side layout
	listView := m.prList.View()
	detailView := m.prDetail.View()

	// Combine views horizontally
	return lipgloss.JoinHorizontal(lipgloss.Top, listView, detailView)
}

func main() {
	// Load configuration
	cfg, err := config.LoadConfig()
	if err != nil {
		fmt.Printf("Configuration error: %v\n", err)
		os.Exit(1)
	}

	// Create API client
	client := api.NewClient(cfg.Email, cfg.APIToken, cfg.Workspace, cfg.Repo)

	m := initialModel()
	m.client = client

	p := tea.NewProgram(m, tea.WithAltScreen())
	if _, err := p.Run(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
