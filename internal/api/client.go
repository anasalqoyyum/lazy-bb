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
	apiToken  string
	workspace string
	repo      string
}

// NewClient creates a new Bitbucket API client
func NewClient(apiToken, workspace, repo string) *Client {
	return &Client{
		baseURL:   "https://api.bitbucket.org/2.0",
		apiToken:  apiToken,
		workspace: workspace,
		repo:      repo,
	}
}

// FetchPRs fetches all pull requests from the repository
func (c *Client) FetchPRs() ([]PR, error) {
	url := fmt.Sprintf("%s/repositories/%s/%s/pullrequests", c.baseURL, c.workspace, c.repo)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set up Bearer token authentication
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.apiToken))
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
