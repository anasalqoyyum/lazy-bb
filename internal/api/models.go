package api

import "time"

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

type AuthorInfo struct {
	Username string `json:"username"`
	FullName string `json:"display_name"`
}

type Links struct {
	Self HTML `json:"self"`
	HTML HTML `json:"html"`
}

type HTML struct {
	Href string `json:"href"`
}

type Reviewer struct {
	Username string `json:"username"`
	FullName string `json:"display_name"`
}

type Branch struct {
	Name       string `json:"name"`
	Repository Repo   `json:"repository"`
}

type Repo struct {
	FullName string `json:"full_name"`
}

type PRListResponse struct {
	Pagelen  int    `json:"pagelen"`
	Page     int    `json:"page"`
	Size     int    `json:"size"`
	Next     string `json:"next"`
	Previous string `json:"previous"`
	Values   []PR   `json:"values"`
}

type Repository struct {
	Slug  string `json:"slug"`
	Name  string `json:"name"`
	Links Links  `json:"links"`
}

type RepositoryListResponse struct {
	Pagelen  int          `json:"pagelen"`
	Page     int          `json:"page"`
	Size     int          `json:"size"`
	Next     string       `json:"next"`
	Previous string       `json:"previous"`
	Values   []Repository `json:"values"`
}
