package ui

import (
	"fmt"
	"strings"

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
	var details strings.Builder

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

	// Created/Updated
	details.WriteString(titleStyle.Render("Dates\n"))
	details.WriteString(fmt.Sprintf("  Created: %s\n", p.PR.CreatedOn))
	details.WriteString(fmt.Sprintf("  Updated: %s\n\n", p.PR.UpdatedOn))

	// Description
	if p.PR.Description != "" {
		details.WriteString(titleStyle.Render("Description\n"))
		// Wrap description to fit width
		wrapped := wrapText(p.PR.Description, p.Width-4)
		details.WriteString(fmt.Sprintf("  %s\n\n", wrapped))
	}

	// Link
	details.WriteString(titleStyle.Render("Link\n"))
	linkStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("33")).Underline(true)
	details.WriteString(linkStyle.Render(fmt.Sprintf("  %s\n", p.PR.Links.HTML.Href)))

	return lipgloss.NewStyle().
		Width(p.Width).
		Height(p.Height).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("63")).
		Padding(1, 2).
		Render(details.String())
}

// wrapText wraps text to a given width
func wrapText(text string, width int) string {
	words := strings.Fields(text)
	var lines []string
	var currentLine []string
	currentLength := 0

	for _, word := range words {
		if currentLength+len(word)+1 > width && len(currentLine) > 0 {
			lines = append(lines, strings.Join(currentLine, " "))
			currentLine = []string{word}
			currentLength = len(word)
		} else {
			currentLine = append(currentLine, word)
			currentLength += len(word) + 1
		}
	}

	if len(currentLine) > 0 {
		lines = append(lines, strings.Join(currentLine, " "))
	}

	return strings.Join(lines, "\n  ")
}
