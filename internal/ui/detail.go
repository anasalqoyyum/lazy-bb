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
		glamour.WithWordWrap(p.Width-4),
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
	details.WriteString(titleStyle.Render("Title\n"))
	details.WriteString(fmt.Sprintf("  %s\n\n", p.PR.Title))

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
	details.WriteString(statusStyle.Render(p.PR.State + "\n\n"))

	// Author
	details.WriteString(titleStyle.Render("Author\n"))
	details.WriteString(fmt.Sprintf("  %s\n\n", p.PR.Author))

	// Repository
	if p.PR.Workspace != "" && p.PR.Repo != "" {
		details.WriteString(titleStyle.Render("Repository\n"))
		details.WriteString(fmt.Sprintf("  %s/%s\n\n", p.PR.Workspace, p.PR.Repo))
	}

	// Created/Updated
	details.WriteString(titleStyle.Render("Dates\n"))
	details.WriteString(fmt.Sprintf("  Created: %s\n", p.PR.CreatedOn))
	details.WriteString(fmt.Sprintf("  Updated: %s\n\n", p.PR.UpdatedOn))

	// Description with markdown rendering
	if p.PR.Description != "" {
		details.WriteString(titleStyle.Render("Description\n"))
		renderedDesc := p.renderMarkdown(p.PR.Description)
		details.WriteString(fmt.Sprintf("  %s\n\n", renderedDesc))
	}

	// Link
	details.WriteString(titleStyle.Render("Link\n"))
	linkStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("33")).Underline(true)
	details.WriteString(linkStyle.Render(fmt.Sprintf("  %s\n", p.PR.Links.HTML.Href)))

	// Get the rendered content
	content := details.String()

	// Wrap content to fit within available width
	wrappedContent := wrapContent(content, p.Width-4)

	return lipgloss.NewStyle().
		Width(p.Width).
		Height(p.Height).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("63")).
		Padding(1, 2).
		Render(wrappedContent)
}

// wrapContent wraps text content to fit within a given width
// while preserving existing line breaks and handling multi-line segments
func wrapContent(content string, width int) string {
	lines := strings.Split(content, "\n")
	var wrapped []string

	for _, line := range lines {
		if len(line) <= width {
			wrapped = append(wrapped, line)
		} else {
			// Wrap long lines
			words := strings.Fields(line)
			var currentLine []string
			currentLength := 0

			for _, word := range words {
				if currentLength+len(word)+1 > width && len(currentLine) > 0 {
					wrapped = append(wrapped, strings.Join(currentLine, " "))
					currentLine = []string{word}
					currentLength = len(word)
				} else {
					currentLine = append(currentLine, word)
					currentLength += len(word) + 1
				}
			}

			if len(currentLine) > 0 {
				wrapped = append(wrapped, strings.Join(currentLine, " "))
			}
		}
	}

	return strings.Join(wrapped, "\n")
}
