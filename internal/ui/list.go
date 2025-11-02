package ui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/mattn/go-runewidth"
)

// Repository represents a repository in the UI
type Repository struct {
	Slug  string
	Name  string
	Links Links
}

// RepoList represents the repo list panel
type RepoList struct {
	Repositories []Repository
	Cursor       int
	Width        int
	Height       int
	Focused      bool
	SelectedIdx  int // Index of the active/selected repository (-1 if none)
}

// NewRepoList creates a new repository list component
func NewRepoList(width, height int) *RepoList {
	return &RepoList{
		Repositories: []Repository{},
		Cursor:       0,
		Width:        width,
		Height:       height,
		Focused:      false,
		SelectedIdx:  -1,
	}
}

// SetRepositories updates the repository list
func (r *RepoList) SetRepositories(repos []Repository) {
	r.Repositories = repos
	if r.Cursor >= len(repos) {
		r.Cursor = 0
	}
}

// MoveUp moves cursor up
func (r *RepoList) MoveUp() {
	if r.Cursor > 0 {
		r.Cursor--
	}
}

// MoveDown moves cursor down
func (r *RepoList) MoveDown() {
	if r.Cursor < len(r.Repositories)-1 {
		r.Cursor++
	}
}

// GetSelected returns the currently selected repository
func (r *RepoList) GetSelected() *Repository {
	if r.Cursor >= 0 && r.Cursor < len(r.Repositories) {
		return &r.Repositories[r.Cursor]
	}
	return nil
}

// SetSelected marks a repository as the active/selected one
func (r *RepoList) SetSelected(idx int) {
	if idx >= 0 && idx < len(r.Repositories) {
		r.SelectedIdx = idx
	}
}

// PRList represents the left panel with PR list
type PRList struct {
	PullRequests []PR
	Cursor       int
	Width        int
	Height       int
	Focused      bool
}

type PR struct {
	ID          int
	Title       string
	Description string
	Author      string
	State       string
	Links       Links
	CreatedOn   string
	UpdatedOn   string
	Workspace   string
	Repo        string
}

type Links struct {
	HTML HTML
}

type HTML struct {
	Href string
}

// NewPRList creates a new PR list component
func NewPRList(width, height int) *PRList {
	return &PRList{
		PullRequests: []PR{},
		Cursor:       0,
		Width:        width,
		Height:       height,
		Focused:      true, // List is focused by default
	}
}

// SetPRs updates the PR list
func (p *PRList) SetPRs(prs []PR) {
	p.PullRequests = prs
	if p.Cursor >= len(prs) {
		p.Cursor = 0
	}
}

// MoveUp moves cursor up
func (p *PRList) MoveUp() {
	if p.Cursor > 0 {
		p.Cursor--
	}
}

// MoveDown moves cursor down
func (p *PRList) MoveDown() {
	if p.Cursor < len(p.PullRequests)-1 {
		p.Cursor++
	}
}

// GetSelected returns the currently selected PR
func (p *PRList) GetSelected() *PR {
	if p.Cursor >= 0 && p.Cursor < len(p.PullRequests) {
		return &p.PullRequests[p.Cursor]
	}
	return nil
}

// truncateString truncates a string to fit within a given width
func truncateString(s string, width int) string {
	if runewidth.StringWidth(s) <= width {
		return s
	}
	for len(s) > 0 {
		s = s[:len(s)-1]
		if runewidth.StringWidth(s) <= width-2 {
			return s + ".."
		}
	}
	return ".."
}

// padString pads a string to a given width
func padString(s string, width int) string {
	currentWidth := runewidth.StringWidth(s)
	if currentWidth >= width {
		return truncateString(s, width)
	}
	return s + strings.Repeat(" ", width-currentWidth)
}

// View renders the PR list as a table
func (p *PRList) View() string {
	if len(p.PullRequests) == 0 {
		return lipgloss.NewStyle().
			Width(p.Width).
			Height(p.Height).
			Align(lipgloss.Center, lipgloss.Center).
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#565f89")).
			Render("No pull requests found")
	}

	// Column widths
	colPR := 5      // PR#
	colTitle := 40  // Title
	colAuthor := 18 // Author
	colState := 6   // State
	colRepo := 40   // Workspace/Repo

	// Calculate available width and adjust columns
	separatorWidth := 10 // " │ " between columns (3 chars * 4 separators - 2 for border)
	totalFixedWidth := colPR + colTitle + colAuthor + colState + colRepo + separatorWidth
	availableWidth := p.Width - 4 // -4 for padding and border

	if availableWidth < totalFixedWidth {
		// Scale down columns proportionally
		scaleFactor := float64(availableWidth) / float64(totalFixedWidth)
		colTitle = int(float64(colTitle) * scaleFactor)
		colAuthor = int(float64(colAuthor) * scaleFactor)
		colRepo = int(float64(colRepo) * scaleFactor)
	}

	// Header style - Tokyo Night colors
	headerStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#ffffff")).
		Background(lipgloss.Color("#1f2335"))

	// Build header (apply style after building plain text)
	headerText := fmt.Sprintf("%s │ %s │ %s │ %s │ %s",
		padString("PR#", colPR),
		padString("Title", colTitle),
		padString("Author", colAuthor),
		padString("State", colState),
		padString("Workspace/Repo", colRepo),
	)
	header := headerStyle.Render(headerText)

	// Build rows
	var rows []string
	maxRows := p.Height - 4 // Leave room for header, border, status

	for i, pr := range p.PullRequests {
		if i >= maxRows {
			break
		}

		// Format columns (plain text first)
		prNum := fmt.Sprintf("%d", pr.ID)
		title := truncateString(pr.Title, colTitle-2)
		author := truncateString(pr.Author, colAuthor-2)

		// State - determine color but don't apply yet
		var stateColor string
		switch pr.State {
		case "OPEN":
			stateColor = "#7aa2f7" // Tokyo Night Blue
		case "MERGED":
			stateColor = "#bb9af7" // Tokyo Night Purple
		case "DECLINED":
			stateColor = "#f7768e" // Tokyo Night Red
		default:
			stateColor = "#a9b1d6" // Tokyo Night Foreground
		}

		// Repo info
		repo := fmt.Sprintf("%s/%s", pr.Workspace, pr.Repo)
		repo = truncateString(repo, colRepo-2)

		// Build row with plain text (apply styling after padding)
		rowText := fmt.Sprintf("%s │ %s │ %s │ %s │ %s",
			padString(prNum, colPR),
			padString(title, colTitle),
			padString(author, colAuthor),
			padString(pr.State, colState),
			padString(repo, colRepo),
		)

		// Now apply styling
		if i == p.Cursor {
			// Highlight selected row with background
			rowText = lipgloss.NewStyle().
				Background(lipgloss.Color("33")).
				Foreground(lipgloss.Color("255")).
				Render(rowText)
		} else {
			// Apply state color styling only to the state column in non-selected rows
			stateStyle := lipgloss.NewStyle().Foreground(lipgloss.Color(stateColor))
			stateStyled := stateStyle.Render(pr.State)
			// Replace the uncolored state with the colored one
			rowText = strings.Replace(rowText, pr.State, stateStyled, 1)
		}

		rows = append(rows, rowText)
	}

	// Separator line
	separatorText := strings.Repeat("─", availableWidth)
	separator := lipgloss.NewStyle().Foreground(lipgloss.Color("#565f89")).Render(separatorText)

	// Build output
	var output strings.Builder

	// Add panel title with Tokyo Night styling
	titleStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#7aa2f7"))
	if p.Focused {
		titleStyle = titleStyle.Bold(true)
	}
	output.WriteString(titleStyle.Render("[1]-PRs") + "\n")
	output.WriteString(separator + "\n")

	output.WriteString(header + "\n")
	output.WriteString(separator + "\n")
	for _, row := range rows {
		output.WriteString(row + "\n")
	}

	// Add status bar
	statusText := fmt.Sprintf("[%d/%d] Use ↑↓ to navigate, Enter to open, r to refresh, q to quit",
		p.Cursor+1, len(p.PullRequests))
	output.WriteString("\n" + statusText)

	// Determine border color based on focus - Tokyo Night colors
	borderColor := lipgloss.Color("#565f89")
	if p.Focused {
		borderColor = lipgloss.Color("#7aa2f7")
	}

	borderStyle := lipgloss.NewStyle().
		Width(p.Width).
		Height(p.Height).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(borderColor).
		Padding(0, 1)

	return borderStyle.Render(output.String())
}

// View renders the repository list as a table
func (r *RepoList) View() string {
	if len(r.Repositories) == 0 {
		return lipgloss.NewStyle().
			Width(r.Width).
			Height(r.Height).
			Align(lipgloss.Center, lipgloss.Center).
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("#565f89")).
			Render("No repositories found")
	}

	// Column widths - just name
	colName := r.Width - 4 // Repo name

	// Calculate available width
	availableWidth := r.Width - 4 // -4 for padding and border

	// Adjust column width if needed
	if availableWidth < colName {
		colName = availableWidth
	}

	// Header style - Tokyo Night colors
	headerStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#ffffff")).
		Background(lipgloss.Color("#1f2335"))

	// Build header
	headerText := padString("Name", colName)
	header := headerStyle.Render(headerText)

	// Build rows
	var rows []string
	maxRows := r.Height - 4 // Leave room for header, border, status

	for i, repo := range r.Repositories {
		if i >= maxRows {
			break
		}

		// Format name
		name := truncateString(repo.Name, colName-2)

		// Build row with plain text (apply styling after padding)
		rowText := padString(name, colName)

		// Apply styling
		if i == r.Cursor && i == r.SelectedIdx {
			// Both cursor and selected - show with bold blue background (active)
			rowText = lipgloss.NewStyle().
				Background(lipgloss.Color("33")).
				Foreground(lipgloss.Color("255")).
				Bold(true).
				Render(rowText)
		} else if i == r.Cursor {
			// Just cursor - show with light background
			rowText = lipgloss.NewStyle().
				Background(lipgloss.Color("33")).
				Foreground(lipgloss.Color("255")).
				Render(rowText)
		} else if i == r.SelectedIdx {
			// Just selected (not cursor) - show with light blue color and prefix
			rowText = lipgloss.NewStyle().
				Foreground(lipgloss.Color("#7aa2f7")).
				Bold(true).
				Render(" " + rowText)
		}

		rows = append(rows, rowText)
	}

	// Separator line
	separatorText := strings.Repeat("─", availableWidth)
	separator := lipgloss.NewStyle().Foreground(lipgloss.Color("#565f89")).Render(separatorText)

	// Build output
	var output strings.Builder

	// Add panel title with Tokyo Night styling
	titleStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#7aa2f7"))
	if r.Focused {
		titleStyle = titleStyle.Bold(true)
	}
	output.WriteString(titleStyle.Render("[3]-Repos") + "\n")
	output.WriteString(separator + "\n")

	output.WriteString(header + "\n")
	output.WriteString(separator + "\n")
	for _, row := range rows {
		output.WriteString(row + "\n")
	}

	// Add status bar
	statusText := fmt.Sprintf("[%d/%d] Use ↑↓ to navigate, Enter to see PRs",
		r.Cursor+1, len(r.Repositories))
	output.WriteString("\n" + statusText)

	// Determine border color based on focus - Tokyo Night colors
	borderColor := lipgloss.Color("#565f89")
	if r.Focused {
		borderColor = lipgloss.Color("#7aa2f7")
	}

	borderStyle := lipgloss.NewStyle().
		Width(r.Width).
		Height(r.Height).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(borderColor).
		Padding(0, 1)

	return borderStyle.Render(output.String())
}
