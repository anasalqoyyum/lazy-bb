package ui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/mattn/go-runewidth"
)

// PRList represents the left panel with PR list
type PRList struct {
	PullRequests []PR
	Cursor       int
	Width        int
	Height       int
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
			BorderForeground(lipgloss.Color("63")).
			Render("No pull requests found")
	}

	// Column widths
	colPR := 5      // PR#
	colTitle := 25  // Title
	colAuthor := 15 // Author
	colState := 10  // State
	colRepo := 15   // Workspace/Repo

	// Calculate available width and adjust columns
	totalFixedWidth := colPR + colTitle + colAuthor + colState + colRepo + 10 // +10 for spacing/borders
	availableWidth := p.Width - 4                                             // -4 for padding and border

	if availableWidth < totalFixedWidth {
		// Scale down columns proportionally
		scaleFactor := float64(availableWidth) / float64(totalFixedWidth)
		colTitle = int(float64(colTitle) * scaleFactor)
		colAuthor = int(float64(colAuthor) * scaleFactor)
		colRepo = int(float64(colRepo) * scaleFactor)
	}

	// Header style
	headerStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("255")).
		Background(lipgloss.Color("63"))

	// Build header
	header := fmt.Sprintf("%s │ %s │ %s │ %s │ %s",
		padString("PR#", colPR),
		padString("Title", colTitle),
		padString("Author", colAuthor),
		padString("State", colState),
		padString("Workspace/Repo", colRepo),
	)
	header = headerStyle.Render(header)

	// Build rows
	var rows []string
	maxRows := p.Height - 4 // Leave room for header, border, status

	for i, pr := range p.PullRequests {
		if i >= maxRows {
			break
		}

		// Format columns
		prNum := fmt.Sprintf("%d", pr.ID)
		title := truncateString(pr.Title, colTitle-2)
		author := truncateString(pr.Author, colAuthor-2)

		// State badge
		stateStyle := lipgloss.NewStyle()
		switch pr.State {
		case "OPEN":
			stateStyle = stateStyle.Foreground(lipgloss.Color("42")) // Green
		case "MERGED":
			stateStyle = stateStyle.Foreground(lipgloss.Color("99")) // Purple
		case "DECLINED":
			stateStyle = stateStyle.Foreground(lipgloss.Color("196")) // Red
		default:
			stateStyle = stateStyle.Foreground(lipgloss.Color("250")) // Gray
		}
		state := stateStyle.Render(pr.State)

		// Repo info
		repo := fmt.Sprintf("%s/%s", pr.Workspace, pr.Repo)
		repo = truncateString(repo, colRepo-2)

		// Build row
		row := fmt.Sprintf("%s │ %s │ %s │ %s │ %s",
			padString(prNum, colPR),
			padString(title, colTitle),
			padString(author, colAuthor),
			padString(state, colState),
			padString(repo, colRepo),
		)

		// Highlight selected row
		if i == p.Cursor {
			row = lipgloss.NewStyle().
				Background(lipgloss.Color("33")).
				Foreground(lipgloss.Color("255")).
				Render(row)
		}

		rows = append(rows, row)
	}

	// Separator line
	separator := lipgloss.NewStyle().Foreground(lipgloss.Color("240")).Render(
		strings.Repeat("─", availableWidth),
	)

	// Build output
	var output strings.Builder
	output.WriteString(header + "\n")
	output.WriteString(separator + "\n")
	for _, row := range rows {
		output.WriteString(row + "\n")
	}

	// Add status bar
	statusText := fmt.Sprintf("[%d/%d] Use ↑↓ to navigate, Enter to open, q to quit",
		p.Cursor+1, len(p.PullRequests))
	output.WriteString("\n" + statusText)

	return lipgloss.NewStyle().
		Width(p.Width).
		Height(p.Height).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("63")).
		Padding(0, 1).
		Render(output.String())
}
