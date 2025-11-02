package config

import (
	"fmt"
	"os"

	"github.com/joho/godotenv"
)

// Config holds the application configuration
type Config struct {
	APIToken  string
	Workspace string
	Project   string
	Repo      string
}

// LoadConfig loads configuration from environment variables or .env file
func LoadConfig() (*Config, error) {
	// Try to load .env file if it exists (don't fail if it doesn't)
	_ = godotenv.Load()

	cfg := &Config{
		APIToken:  os.Getenv("BITBUCKET_TOKEN"),
		Workspace: os.Getenv("BITBUCKET_WORKSPACE"),
		Project:   os.Getenv("BITBUCKET_PROJECT"),
		Repo:      os.Getenv("BITBUCKET_REPO"),
	}

	// Validate required fields
	var missingFields []string
	if cfg.APIToken == "" {
		missingFields = append(missingFields, "BITBUCKET_TOKEN")
	}
	if cfg.Workspace == "" {
		missingFields = append(missingFields, "BITBUCKET_WORKSPACE")
	}
	if cfg.Repo == "" {
		missingFields = append(missingFields, "BITBUCKET_REPO")
	}

	if len(missingFields) > 0 {
		return nil, fmt.Errorf("missing required environment variables: %v", missingFields)
	}

	return cfg, nil
}
