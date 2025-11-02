package api

import "time"

// PR represents a Bitbucket pull request
type PR struct {
	ID          int        `json:"id"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Author      AuthorInfo `json:"author"`
	State       string     `json:"state"`
	CreatedOn   time.Time  `json:"created_on"`
	UpdatedOn   time.Time  `json:"updated_on"`
	Links       Links      `json:"links"`
	Reviewers   []Reviewer `json:"reviewers"`
	Source      Branch     `json:"source"`
	Destination Branch     `json:"destination"`
}

// AuthorInfo contains author information
type AuthorInfo struct {
	Username string `json:"username"`
	FullName string `json:"display_name"`
}

// Links contains Bitbucket API links
type Links struct {
	Self HTML `json:"self"`
	HTML HTML `json:"html"`
}

// HTML represents a link with href
type HTML struct {
	Href string `json:"href"`
}

// Reviewer represents a PR reviewer
type Reviewer struct {
	Username string `json:"username"`
	FullName string `json:"display_name"`
}

// Branch represents a git branch
type Branch struct {
	Name       string `json:"name"`
	Repository Repo   `json:"repository"`
}

// Repo represents a repository reference
type Repo struct {
	FullName string `json:"full_name"`
}

// PRListResponse is the response from Bitbucket API
type PRListResponse struct {
	Pagelen  int    `json:"pagelen"`
	Page     int    `json:"page"`
	Size     int    `json:"size"`
	Next     string `json:"next"`
	Previous string `json:"previous"`
	Values   []PR   `json:"values"`
}

// Repository represents a Bitbucket repository
type Repository struct {
	Slug  string `json:"slug"`
	Name  string `json:"name"`
	Links Links  `json:"links"`
}

// RepositoryListResponse is the response from Bitbucket repositories API
type RepositoryListResponse struct {
	Pagelen  int          `json:"pagelen"`
	Page     int          `json:"page"`
	Size     int          `json:"size"`
	Next     string       `json:"next"`
	Previous string       `json:"previous"`
	Values   []Repository `json:"values"`
}
