package ui

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/charmbracelet/glamour"
	"github.com/charmbracelet/lipgloss"
)

// PRDetail represents the right panel with PR details
type PRDetail struct {
	PR     *PR
	Width  int
	Height int
}

// NewPRDetail creates a new PR detail component
func NewPRDetail(width, height int) *PRDetail {
	return &PRDetail{
		PR:     nil,
		Width:  width,
		Height: height,
	}
}

// SetPR sets the PR to display
func (p *PRDetail) SetPR(pr *PR) {
	p.PR = pr
}

// renderMarkdown renders markdown content using glamour (glow's library)
func (p *PRDetail) renderMarkdown(content string) string {
	if content == "" {
		return ""
	}

	// Create a glamour renderer with dark mode
	renderer, err := glamour.NewTermRenderer(
		glamour.WithAutoStyle(),
		glamour.WithWordWrap(p.Width-6), // Account for padding
	)
	if err != nil {
		// Fallback to plain text if markdown rendering fails
		return content
	}

	rendered, err := renderer.Render(content)
	if err != nil {
		// Fallback to plain text if markdown rendering fails
		return content
	}

	// Remove trailing newlines added by glamour
	return strings.TrimRight(rendered, "\n")
}

// View renders the PR details
func (p *PRDetail) View() string {
	if p.PR == nil {
		return lipgloss.NewStyle().
			Width(p.Width).
			Height(p.Height).
			Align(lipgloss.Center, lipgloss.Center).
			Border(lipgloss.RoundedBorder()).
			BorderForeground(lipgloss.Color("63")).
			Render("Select a PR to view details")
	}

	// Build detail view
	var details bytes.Buffer

	// Title
	titleStyle := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("87"))
	details.WriteString(titleStyle.Render("Title"))
	details.WriteString("\n")
	details.WriteString(fmt.Sprintf("  %s\n\n", truncateForDisplay(p.PR.Title, p.Width-6)))

	// ID and Status
	statusStyle := lipgloss.NewStyle()
	switch p.PR.State {
	case "OPEN":
		statusStyle = statusStyle.Foreground(lipgloss.Color("42"))
	case "MERGED":
		statusStyle = statusStyle.Foreground(lipgloss.Color("99"))
	case "DECLINED":
		statusStyle = statusStyle.Foreground(lipgloss.Color("196"))
	}

	details.WriteString(titleStyle.Render("PR #" + fmt.Sprintf("%d", p.PR.ID) + " - "))
	details.WriteString(statusStyle.Render(p.PR.State))
	details.WriteString("\n\n")

	// Author
	details.WriteString(titleStyle.Render("Author"))
	details.WriteString("\n")
	details.WriteString(fmt.Sprintf("  %s\n\n", p.PR.Author))

	// Repository
	if p.PR.Workspace != "" && p.PR.Repo != "" {
		details.WriteString(titleStyle.Render("Repository"))
		details.WriteString("\n")
		details.WriteString(fmt.Sprintf("  %s/%s\n\n", p.PR.Workspace, p.PR.Repo))
	}

	// Created/Updated
	details.WriteString(titleStyle.Render("Dates"))
	details.WriteString("\n")
	details.WriteString(fmt.Sprintf("  Created: %s\n", p.PR.CreatedOn))
	details.WriteString(fmt.Sprintf("  Updated: %s\n\n", p.PR.UpdatedOn))

	// Description with markdown rendering
	if p.PR.Description != "" {
		details.WriteString(titleStyle.Render("Description"))
		details.WriteString("\n")
		renderedDesc := p.renderMarkdown(p.PR.Description)

		details.WriteString(fmt.Sprintf("  %s\n\n", renderedDesc))
	}

	// Link
	details.WriteString(titleStyle.Render("Link"))
	details.WriteString("\n")
	linkStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("33")).Underline(true)
	details.WriteString(linkStyle.Render(fmt.Sprintf("  %s\n", truncateForDisplay(p.PR.Links.HTML.Href, p.Width-6))))

	// Get the rendered content
	content := details.String()

	// Wrap content to fit within available width
	wrappedContent := wrapContent(content, p.Width-6)

	// Limit total height
	contentLines := strings.Split(wrappedContent, "\n")
	maxLines := p.Height - 4
	if len(contentLines) > maxLines {
		contentLines = contentLines[:maxLines]
		wrappedContent = strings.Join(contentLines, "\n")
	}

	return lipgloss.NewStyle().
		Width(p.Width).
		Height(p.Height).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("63")).
		Padding(1, 2).
		Render(wrappedContent)
}

// truncateForDisplay truncates a string to fit within a display width
func truncateForDisplay(s string, width int) string {
	if len(s) <= width {
		return s
	}
	if width <= 3 {
		return "..."
	}
	return s[:width-3] + "..."
}

// stripANSI removes ANSI escape sequences from a string for length calculation
func stripANSI(s string) string {
	// Simple regex to remove ANSI escape codes
	ansiRe := strings.NewReplacer(
		"\033[0m", "",
		"\033[1m", "",
		"\033[3m", "",
		"\033[4m", "",
		"\033[90m", "", "\033[91m", "", "\033[92m", "", "\033[93m", "",
		"\033[94m", "", "\033[95m", "", "\033[96m", "", "\033[97m", "",
	)
	// Handle remaining ANSI codes with pattern matching
	s = ansiRe.Replace(s)
	// Remove any remaining color codes
	for i := 0; i < len(s); i++ {
		if s[i] == '\033' {
			// Find the end of the escape sequence
			end := strings.IndexByte(s[i+1:], 'm')
			if end != -1 {
				s = s[:i] + s[i+1+end+1:]
				i--
			}
		}
	}
	return s
}

// wrapContent wraps text content to fit within a given width
// while preserving existing line breaks and handling multi-line segments
func wrapContent(content string, width int) string {
	lines := strings.Split(content, "\n")
	var wrapped []string

	for _, line := range lines {
		// Use plain text length for wrapping decisions
		plainLine := stripANSI(line)
		if len(plainLine) <= width {
			wrapped = append(wrapped, line)
		} else {
			// For lines with ANSI codes, just keep them as-is but limit output
			if len(line) > width*2 { // Safety check for very long ANSI lines
				wrapped = append(wrapped, line[:min(len(line), width*2)])
			} else {
				wrapped = append(wrapped, line)
			}
		}
	}

	return strings.Join(wrapped, "\n")
}

// min returns the minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
