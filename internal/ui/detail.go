package ui

import (
	"bytes"
	"fmt"
	"strings"

	"github.com/charmbracelet/glamour"
	"github.com/charmbracelet/lipgloss"
)

type PRDetail struct {
	PR           *PR
	Width        int
	Height       int
	Focused      bool
	ScrollOffset int
}

func NewPRDetail(width, height int) *PRDetail {
	return &PRDetail{
		PR:           nil,
		Width:        width,
		Height:       height,
		Focused:      false,
		ScrollOffset: 0,
	}
}

func (p *PRDetail) SetPR(pr *PR) {
	p.PR = pr
	p.ScrollOffset = 0
}

func (p *PRDetail) ScrollUp() {
	if p.ScrollOffset > 0 {
		p.ScrollOffset--
	}
}

func (p *PRDetail) ScrollDown() {
	totalLines := p.calculateTotalLines()
	maxLines := p.Height - 4
	maxScroll := max(totalLines-maxLines, 0)
	if p.ScrollOffset < maxScroll {
		p.ScrollOffset++
	}
}

func (p *PRDetail) ScrollUpHalf() {
	halfPage := (p.Height - 4) / 2
	if p.ScrollOffset > halfPage {
		p.ScrollOffset -= halfPage
	} else {
		p.ScrollOffset = 0
	}
}

func (p *PRDetail) ScrollDownHalf() {
	halfPage := (p.Height - 4) / 2
	totalLines := p.calculateTotalLines()
	maxLines := p.Height - 4
	maxScroll := max(totalLines-maxLines, 0)
	newOffset := p.ScrollOffset + halfPage
	if newOffset > maxScroll {
		p.ScrollOffset = maxScroll
	} else {
		p.ScrollOffset = newOffset
	}
}

func (p *PRDetail) calculateTotalLines() int {
	if p.PR == nil {
		return 0
	}

	var details bytes.Buffer

	details.WriteString("[Title]\n")
	details.WriteString(fmt.Sprintf("  %s\n\n", truncateForDisplay(p.PR.Title, p.Width-6)))

	details.WriteString(fmt.Sprintf("[PR #%d - %s]\n\n", p.PR.ID, p.PR.State))

	details.WriteString("[Author]\n")
	details.WriteString(fmt.Sprintf("  %s\n\n", p.PR.Author))

	if p.PR.Workspace != "" && p.PR.Repo != "" {
		details.WriteString("[Repository]\n")
		details.WriteString(fmt.Sprintf("  %s/%s\n\n", p.PR.Workspace, p.PR.Repo))
	}

	details.WriteString("[Dates]\n")
	details.WriteString(fmt.Sprintf("  Created: %s\n", p.PR.CreatedOn))
	details.WriteString(fmt.Sprintf("  Updated: %s\n\n", p.PR.UpdatedOn))

	if p.PR.Description != "" {
		details.WriteString("[Description]\n")
		renderedDesc := p.renderMarkdown(p.PR.Description)
		details.WriteString(fmt.Sprintf("  %s\n\n", renderedDesc))
	}

	details.WriteString("[Link]\n")
	details.WriteString(fmt.Sprintf("  %s\n", truncateForDisplay(p.PR.Links.HTML.Href, p.Width-6)))

	content := details.String()

	wrappedContent := wrapContent(content, p.Width-6)

	contentLines := strings.Split(wrappedContent, "\n")
	return len(contentLines)
}

func (p *PRDetail) renderMarkdown(content string) string {
	if content == "" {
		return ""
	}

	renderer, err := glamour.NewTermRenderer(
		glamour.WithAutoStyle(),
		glamour.WithWordWrap(p.Width-6),
	)
	if err != nil {
		return content
	}

	rendered, err := renderer.Render(content)
	if err != nil {
		return content
	}

	return strings.TrimRight(rendered, "\n")
}

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

	var details bytes.Buffer

	titleStyle := lipgloss.NewStyle().Bold(true).Foreground(lipgloss.Color("#7aa2f7"))
	details.WriteString(titleStyle.Render("Title"))
	details.WriteString("\n")
	details.WriteString(fmt.Sprintf("  %s\n\n", truncateForDisplay(p.PR.Title, p.Width-6)))

	statusStyle := lipgloss.NewStyle()
	switch p.PR.State {
	case "OPEN":
		statusStyle = statusStyle.Foreground(lipgloss.Color("#7aa2f7"))
	case "MERGED":
		statusStyle = statusStyle.Foreground(lipgloss.Color("#bb9af7"))
	case "DECLINED":
		statusStyle = statusStyle.Foreground(lipgloss.Color("#f7768e"))
	}

	details.WriteString(titleStyle.Render("PR #" + fmt.Sprintf("%d", p.PR.ID) + " - "))
	details.WriteString(statusStyle.Render(p.PR.State))
	details.WriteString("\n\n")

	details.WriteString(titleStyle.Render("Author"))
	details.WriteString("\n")
	details.WriteString(fmt.Sprintf("  %s\n\n", p.PR.Author))

	if p.PR.Workspace != "" && p.PR.Repo != "" {
		details.WriteString(titleStyle.Render("Repository"))
		details.WriteString("\n")
		details.WriteString(fmt.Sprintf("  %s/%s\n\n", p.PR.Workspace, p.PR.Repo))
	}

	details.WriteString(titleStyle.Render("Dates"))
	details.WriteString("\n")
	details.WriteString(fmt.Sprintf("  Created: %s\n", p.PR.CreatedOn))
	details.WriteString(fmt.Sprintf("  Updated: %s\n\n", p.PR.UpdatedOn))

	if p.PR.Description != "" {
		details.WriteString(titleStyle.Render("Description"))
		details.WriteString("\n")
		renderedDesc := p.renderMarkdown(p.PR.Description)

		details.WriteString(fmt.Sprintf("  %s\n\n", renderedDesc))
	}

	details.WriteString(titleStyle.Render("Link"))
	details.WriteString("\n")
	linkStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#7aa2f7")).Underline(true)
	details.WriteString(linkStyle.Render(fmt.Sprintf("  %s\n", truncateForDisplay(p.PR.Links.HTML.Href, p.Width-6))))

	content := details.String()

	wrappedContent := wrapContent(content, p.Width-6)

	contentLines := strings.Split(wrappedContent, "\n")
	maxLines := p.Height - 4

	startLine := p.ScrollOffset
	if startLine >= len(contentLines) {
		startLine = max(len(contentLines)-maxLines, 0)
	}

	var displayLines []string
	for i := startLine; i < len(contentLines) && len(displayLines) < maxLines; i++ {
		displayLines = append(displayLines, contentLines[i])
	}

	displayContent := strings.Join(displayLines, "\n")

	borderColor := lipgloss.Color("#565f89")
	if p.Focused {
		borderColor = lipgloss.Color("#7aa2f7")
	}

	panelTitleStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#7aa2f7"))
	if p.Focused {
		panelTitleStyle = panelTitleStyle.Bold(true)
	}
	titleLine := panelTitleStyle.Render("[2]-Details")

	separatorLine := lipgloss.NewStyle().Foreground(lipgloss.Color("#565f89")).Render(strings.Repeat("─", p.Width-6))

	finalContent := titleLine + "\n" + separatorLine + "\n" + displayContent

	return lipgloss.NewStyle().
		Width(p.Width).
		Height(p.Height).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(borderColor).
		Padding(0, 2).
		Render(finalContent)
}

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
	ansiRe := strings.NewReplacer(
		"\033[0m", "",
		"\033[1m", "",
		"\033[3m", "",
		"\033[4m", "",
		"\033[90m", "", "\033[91m", "", "\033[92m", "", "\033[93m", "",
		"\033[94m", "", "\033[95m", "", "\033[96m", "", "\033[97m", "",
	)
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
		plainLine := stripANSI(line)
		if len(plainLine) <= width {
			wrapped = append(wrapped, line)
		} else {
			// For lines with ANSI codes, just keep them as-is but limit output
			if len(line) > width*2 {
				wrapped = append(wrapped, line[:min(len(line), width*2)])
			} else {
				wrapped = append(wrapped, line)
			}
		}
	}

	return strings.Join(wrapped, "\n")
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
