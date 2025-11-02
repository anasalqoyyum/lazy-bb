package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// Client is a Bitbucket API client
type Client struct {
	baseURL   string
	email     string
	apiToken  string
	workspace string
	repo      string
}

// NewClient creates a new Bitbucket API client
func NewClient(email, apiToken, workspace, repo string) *Client {
	return &Client{
		baseURL:   "https://api.bitbucket.org/2.0",
		email:     email,
		apiToken:  apiToken,
		workspace: workspace,
		repo:      repo,
	}
}

// FetchPRs fetches all pull requests from the repository
// If repoSlug is empty, uses the default repo from client config
func (c *Client) FetchPRs(repoSlug string) ([]PR, error) {
	repo := c.repo
	if repoSlug != "" {
		repo = repoSlug
	}

	url := fmt.Sprintf("%s/repositories/%s/%s/pullrequests", c.baseURL, c.workspace, repo)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set up Basic Auth with email:apiToken
	req.SetBasicAuth(c.email, c.apiToken)
	req.Header.Set("Accept", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch PRs: %w", err)
	}
	defer resp.Body.Close()

	// Check for HTTP errors
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var prList PRListResponse
	if err := json.Unmarshal(body, &prList); err != nil {
		return nil, fmt.Errorf("failed to parse PR list: %w", err)
	}

	return prList.Values, nil
}

// FetchRepositories fetches all repositories from the workspace with a specific role
func (c *Client) FetchRepositories(role string) ([]Repository, error) {
	url := fmt.Sprintf("%s/repositories/%s", c.baseURL, c.workspace)
	if role != "" {
		url = fmt.Sprintf("%s?role=%s", url, role)
	}

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set up Basic Auth with email:apiToken
	req.SetBasicAuth(c.email, c.apiToken)
	req.Header.Set("Accept", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch repositories: %w", err)
	}
	defer resp.Body.Close()

	// Check for HTTP errors
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var repoList RepositoryListResponse
	if err := json.Unmarshal(body, &repoList); err != nil {
		return nil, fmt.Errorf("failed to parse repository list: %w", err)
	}

	return repoList.Values, nil
}
