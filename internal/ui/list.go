package ui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/mattn/go-runewidth"
)

type Repository struct {
	Slug  string
	Name  string
	Links Links
}

type RepoList struct {
	Repositories []Repository
	Cursor       int
	Width        int
	Height       int
	Focused      bool
	SelectedIdx  int
}

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

func (r *RepoList) SetRepositories(repos []Repository) {
	r.Repositories = repos
	if r.Cursor >= len(repos) {
		r.Cursor = 0
	}
}

func (r *RepoList) MoveUp() {
	if r.Cursor > 0 {
		r.Cursor--
	}
}

func (r *RepoList) MoveDown() {
	if r.Cursor < len(r.Repositories)-1 {
		r.Cursor++
	}
}

func (r *RepoList) GetSelected() *Repository {
	if r.Cursor >= 0 && r.Cursor < len(r.Repositories) {
		return &r.Repositories[r.Cursor]
	}
	return nil
}

func (r *RepoList) SetSelected(idx int) {
	if idx >= 0 && idx < len(r.Repositories) {
		r.SelectedIdx = idx
	}
}

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

func NewPRList(width, height int) *PRList {
	return &PRList{
		PullRequests: []PR{},
		Cursor:       0,
		Width:        width,
		Height:       height,
		Focused:      true, // List is focused by default
	}
}

func (p *PRList) SetPRs(prs []PR) {
	p.PullRequests = prs
	if p.Cursor >= len(prs) {
		p.Cursor = 0
	}
}

func (p *PRList) MoveUp() {
	if p.Cursor > 0 {
		p.Cursor--
	}
}

func (p *PRList) MoveDown() {
	if p.Cursor < len(p.PullRequests)-1 {
		p.Cursor++
	}
}

func (p *PRList) GetSelected() *PR {
	if p.Cursor >= 0 && p.Cursor < len(p.PullRequests) {
		return &p.PullRequests[p.Cursor]
	}
	return nil
}

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

func padString(s string, width int) string {
	currentWidth := runewidth.StringWidth(s)
	if currentWidth >= width {
		return truncateString(s, width)
	}
	return s + strings.Repeat(" ", width-currentWidth)
}

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

	colPR := 5
	colTitle := 40
	colAuthor := 18
	colState := 6
	colRepo := 40

	separatorWidth := 10 // " │ " between columns (3 chars * 4 separators - 2 for border)
	totalFixedWidth := colPR + colTitle + colAuthor + colState + colRepo + separatorWidth
	availableWidth := p.Width - 4 // -4 for padding and border

	if availableWidth < totalFixedWidth {
		scaleFactor := float64(availableWidth) / float64(totalFixedWidth)
		colTitle = int(float64(colTitle) * scaleFactor)
		colAuthor = int(float64(colAuthor) * scaleFactor)
		colRepo = int(float64(colRepo) * scaleFactor)
	}

	headerStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#ffffff")).
		Background(lipgloss.Color("#1f2335"))

	headerText := fmt.Sprintf("%s │ %s │ %s │ %s │ %s",
		padString("PR#", colPR),
		padString("Title", colTitle),
		padString("Author", colAuthor),
		padString("State", colState),
		padString("Workspace/Repo", colRepo),
	)
	header := headerStyle.Render(headerText)

	var rows []string
	maxRows := p.Height - 4 // Leave room for header, border, status

	for i, pr := range p.PullRequests {
		if i >= maxRows {
			break
		}

		prNum := fmt.Sprintf("%d", pr.ID)
		title := truncateString(pr.Title, colTitle-2)
		author := truncateString(pr.Author, colAuthor-2)

		var stateColor string
		switch pr.State {
		case "OPEN":
			stateColor = "#7aa2f7"
		case "MERGED":
			stateColor = "#bb9af7"
		case "DECLINED":
			stateColor = "#f7768e"
		default:
			stateColor = "#a9b1d6"
		}

		repo := fmt.Sprintf("%s/%s", pr.Workspace, pr.Repo)
		repo = truncateString(repo, colRepo-2)

		rowText := fmt.Sprintf("%s │ %s │ %s │ %s │ %s",
			padString(prNum, colPR),
			padString(title, colTitle),
			padString(author, colAuthor),
			padString(pr.State, colState),
			padString(repo, colRepo),
		)

		if i == p.Cursor {
			rowText = lipgloss.NewStyle().
				Background(lipgloss.Color("33")).
				Foreground(lipgloss.Color("255")).
				Render(rowText)
		} else {
			stateStyle := lipgloss.NewStyle().Foreground(lipgloss.Color(stateColor))
			stateStyled := stateStyle.Render(pr.State)
			rowText = strings.Replace(rowText, pr.State, stateStyled, 1)
		}

		rows = append(rows, rowText)
	}

	separatorText := strings.Repeat("─", availableWidth)
	separator := lipgloss.NewStyle().Foreground(lipgloss.Color("#565f89")).Render(separatorText)

	var output strings.Builder

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

	statusText := fmt.Sprintf("[%d/%d] Use ↑↓ to navigate, Enter to open, r to refresh, q to quit",
		p.Cursor+1, len(p.PullRequests))
	output.WriteString("\n" + statusText)

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

	colName := r.Width - 4
	availableWidth := r.Width - 4 // -4 for padding and border

	if availableWidth < colName {
		colName = availableWidth
	}

	headerStyle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#ffffff")).
		Background(lipgloss.Color("#1f2335"))

	headerText := padString("Name", colName)
	header := headerStyle.Render(headerText)

	var rows []string
	maxRows := r.Height - 4 // Leave room for header, border, status

	for i, repo := range r.Repositories {
		if i >= maxRows {
			break
		}

		name := truncateString(repo.Name, colName-2)

		rowText := padString(name, colName)

		if i == r.Cursor && i == r.SelectedIdx {
			rowText = lipgloss.NewStyle().
				Background(lipgloss.Color("33")).
				Foreground(lipgloss.Color("255")).
				Bold(true).
				Render(rowText)
		} else if i == r.Cursor {
			rowText = lipgloss.NewStyle().
				Background(lipgloss.Color("33")).
				Foreground(lipgloss.Color("255")).
				Render(rowText)
		} else if i == r.SelectedIdx {
			rowText = lipgloss.NewStyle().
				Foreground(lipgloss.Color("#7aa2f7")).
				Bold(true).
				Render(" " + rowText)
		}

		rows = append(rows, rowText)
	}

	separatorText := strings.Repeat("─", availableWidth)
	separator := lipgloss.NewStyle().Foreground(lipgloss.Color("#565f89")).Render(separatorText)

	var output strings.Builder

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

	statusText := fmt.Sprintf("[%d/%d] Use ↑↓ to navigate, Enter to see PRs",
		r.Cursor+1, len(r.Repositories))
	output.WriteString("\n" + statusText)

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
