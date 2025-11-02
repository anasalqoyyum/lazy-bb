package ui

import (
	"fmt"

	"github.com/charmbracelet/lipgloss"
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

// View renders the PR list
func (p *PRList) View() string {
	if len(p.PullRequests) == 0 {
		return lipgloss.NewStyle().
			Width(p.Width).
			Height(p.Height).
			Align(lipgloss.Center, lipgloss.Center).
			Render("No pull requests found")
	}

	var output string
	maxLines := p.Height - 2 // Leave room for border/header

	for i, pr := range p.PullRequests {
		if i >= maxLines {
			break
		}

		// Truncate title to fit width
		title := pr.Title
		maxWidth := p.Width - 4
		if len(title) > maxWidth {
			title = title[:maxWidth-2] + ".."
		}

		// Create status badge
		statusStyle := lipgloss.NewStyle()
		switch pr.State {
		case "OPEN":
			statusStyle = statusStyle.Foreground(lipgloss.Color("42")) // Green
		case "MERGED":
			statusStyle = statusStyle.Foreground(lipgloss.Color("99")) // Purple
		case "DECLINED":
			statusStyle = statusStyle.Foreground(lipgloss.Color("196")) // Red
		default:
			statusStyle = statusStyle.Foreground(lipgloss.Color("250")) // Gray
		}

		statusBadge := statusStyle.Render(fmt.Sprintf("[%s]", pr.State))

		// Highlight selected item
		line := fmt.Sprintf(" #%-3d %s %s", pr.ID, title, statusBadge)
		if i == p.Cursor {
			line = lipgloss.NewStyle().
				Background(lipgloss.Color("33")).
				Foreground(lipgloss.Color("255")).
				Render(line)
		}

		output += line + "\n"
	}

	// Add status bar
	output += fmt.Sprintf("\n[%d/%d] Use ↑↓ to navigate, Enter to open, q to quit",
		p.Cursor+1, len(p.PullRequests))

	return lipgloss.NewStyle().
		Width(p.Width).
		Height(p.Height).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("63")).
		Padding(0, 1).
		Render(output)
}
