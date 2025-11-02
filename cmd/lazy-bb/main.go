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

// reposMsg is used to update repos list
type reposMsg struct {
	repos []ui.Repository
}

// statusMsg is used to update PR list
type statusMsg struct {
	prs      []api.PR
	repoSlug string // Track which repo these PRs belong to
}

type model struct {
	spinner           spinner.Model
	quitting          bool
	err               error
	loading           bool
	client            *api.Client
	prList            *ui.PRList
	prDetail          *ui.PRDetail
	repoList          *ui.RepoList
	width             int
	height            int
	prs               []api.PR
	repos             []ui.Repository
	selectedRepo      *ui.Repository
	loadingPRs        bool   // Separate loading state for PRs only
	lastRequestedRepo string // Track the slug of the most recently requested repo
}

var quitKeys = key.NewBinding(
	key.WithKeys("q", "esc", "ctrl+c"),
	key.WithHelp("q/esc", "q to quit"),
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

var focusRepoListKeys = key.NewBinding(
	key.WithKeys("3"),
	key.WithHelp("3", "focus repo list"),
)

var cycleLeftPaneKeys = key.NewBinding(
	key.WithKeys("tab"),
	key.WithHelp("tab", "cycle PR/Repo"),
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
	quarterHeight := 15

	return model{
		spinner:  s,
		loading:  true,
		prList:   ui.NewPRList(halfWidth, quarterHeight),
		prDetail: ui.NewPRDetail(halfWidth, quarterHeight*2),
		repoList: ui.NewRepoList(halfWidth, quarterHeight),
		width:    halfWidth * 2,
		height:   quarterHeight * 4,
	}
}

func (m model) Init() tea.Cmd {
	return tea.Batch(
		m.spinner.Tick,
		fetchReposCmd(m.client),
	)
}

// fetchReposCmd fetches repositories from Bitbucket API
func fetchReposCmd(client *api.Client) tea.Cmd {
	return func() tea.Msg {
		if client == nil {
			return errMsg(fmt.Errorf("client not initialized"))
		}

		repos, err := client.FetchRepositories("admin")
		if err != nil {
			return errMsg(err)
		}

		// Convert to UI repositories
		uiRepos := make([]ui.Repository, len(repos))
		for i, repo := range repos {
			uiRepos[i] = ui.Repository{
				Slug:  repo.Slug,
				Name:  repo.Name,
				Links: ui.Links{HTML: ui.HTML{Href: repo.Links.HTML.Href}},
			}
		}

		return reposMsg{repos: uiRepos}
	}
}

// fetchPRsCmd fetches PRs from Bitbucket API for a specific repo
func fetchPRsCmd(client *api.Client, repoSlug string) tea.Cmd {
	return func() tea.Msg {
		if client == nil {
			return errMsg(fmt.Errorf("client not initialized"))
		}

		prs, err := client.FetchPRs(repoSlug)
		if err != nil {
			return errMsg(err)
		}

		return statusMsg{prs: prs, repoSlug: repoSlug}
	}
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		// Split width 50:50 between lists and detail, accounting for borders properly
		// Each panel has 2-char borders (left and right), so effective content width is Width - 4 per panel
		// We want: left_content + left_borders + right_content + right_borders = total_width
		// Simplified: (width - 4) / 2 for each panel's inner content
		panelWidth := (msg.Width - 4) / 2
		quarterHeight := (msg.Height - 4) / 2 // -4 for borders, split in half

		m.prList.Width = panelWidth
		m.repoList.Width = panelWidth
		m.prList.Height = quarterHeight
		m.repoList.Height = quarterHeight

		m.prDetail.Width = panelWidth
		m.prDetail.Height = msg.Height - 2 // Full height minus border
		return m, nil

	case tea.KeyMsg:
		if key.Matches(msg, quitKeys) {
			m.quitting = true
			return m, tea.Quit
		}

		// Handle refresh
		if key.Matches(msg, refreshKeys) && !m.loadingPRs {
			m.loadingPRs = true
			return m, fetchPRsCmd(m.client, "")
		}

		// Handle focus switching
		if key.Matches(msg, focusPRListKeys) && !m.loadingPRs {
			// Only allow focus if there are PRs to display
			if len(m.prs) > 0 {
				m.prList.Focused = true
				m.prDetail.Focused = false
				m.repoList.Focused = false
			}
			return m, nil
		}

		if key.Matches(msg, focusDetailKeys) && !m.loadingPRs {
			m.prList.Focused = false
			m.prDetail.Focused = true
			m.repoList.Focused = false
			return m, nil
		}

		if key.Matches(msg, focusRepoListKeys) {
			// Only allow focus if there are repos to display
			if len(m.repos) > 0 {
				m.prList.Focused = false
				m.prDetail.Focused = false
				m.repoList.Focused = true
			}
			return m, nil
		}

		// Handle Tab to cycle between PR list and Repo list
		if key.Matches(msg, cycleLeftPaneKeys) {
			if m.prList.Focused {
				// Cycle from PR list to Repo list (only if repos exist)
				if len(m.repos) > 0 {
					m.prList.Focused = false
					m.repoList.Focused = true
				}
			} else if m.repoList.Focused {
				// Cycle from Repo list to PR list (only if PRs exist)
				if len(m.prs) > 0 {
					m.repoList.Focused = false
					m.prList.Focused = true
				}
			}
			return m, nil
		}

		// If PR list is focused, navigate through PRs
		if m.prList.Focused && !m.loadingPRs && len(m.prs) > 0 {
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

		// If repo list is focused, navigate through repos
		if m.repoList.Focused && len(m.repos) > 0 {
			if key.Matches(msg, upKeys) {
				m.repoList.MoveUp()
				return m, nil
			}

			if key.Matches(msg, downKeys) {
				m.repoList.MoveDown()
				return m, nil
			}

			if key.Matches(msg, enterKeys) {
				selected := m.repoList.GetSelected()
				if selected != nil {
					m.selectedRepo = selected
					m.repoList.SetSelected(m.repoList.Cursor)
					// Track that we're requesting PRs for this repo
					m.lastRequestedRepo = selected.Slug
					// Start loading PRs for the selected repo
					m.loadingPRs = true
					return m, fetchPRsCmd(m.client, selected.Slug)
				}
				return m, nil
			}
		}

		// If detail is focused, scroll through content
		if m.prDetail.Focused && !m.loadingPRs {
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

	case reposMsg:
		m.repos = msg.repos
		m.repoList.SetRepositories(msg.repos)

		// Auto-select the first repo if available
		if len(msg.repos) > 0 {
			m.selectedRepo = &msg.repos[0]
			m.repoList.SetSelected(0)
			// Track that we're requesting PRs for this repo
			m.lastRequestedRepo = msg.repos[0].Slug
			// Fetch PRs for the first repo
			m.loadingPRs = true
			return m, fetchPRsCmd(m.client, msg.repos[0].Slug)
		}

		// No repos found, stop loading
		m.loading = false
		return m, nil

	case statusMsg:
		// Only update PRs if they're from the most recently requested repo
		// This prevents out-of-order responses from showing old data
		if msg.repoSlug != m.lastRequestedRepo {
			m.loadingPRs = false
			return m, nil
		}

		m.loadingPRs = false
		m.loading = false // Mark complete loading as done
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
		m.loadingPRs = false
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
		// Initial loading (repos + PRs)
		str := fmt.Sprintf("\n\n   %s Loading... %s\n\n", m.spinner.View(), quitKeys.Help().Desc)
		if m.quitting {
			return str + "\n"
		}
		return str
	}

	// Create left panel: PR list + Repo list (stacked vertically)
	prListView := m.prList.View()
	repoListView := m.repoList.View()

	// If loading PRs, show spinner in PR list area
	if m.loadingPRs {
		prListView = lipgloss.NewStyle().
			Width(m.prList.Width).
			Height(m.prList.Height).
			Align(lipgloss.Center, lipgloss.Center).
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#565f89")).
			Render(fmt.Sprintf("%s Loading PRs...", m.spinner.View()))
	}

	leftPanel := lipgloss.JoinVertical(lipgloss.Top, prListView, repoListView)

	// Create right panel: Detail view (full height)
	detailView := m.prDetail.View()

	// Combine left and right panels horizontally
	return lipgloss.JoinHorizontal(lipgloss.Top, leftPanel, detailView)
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
