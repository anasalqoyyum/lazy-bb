.PHONY: build clean run help

# Variables
BINARY_NAME=lazy-bb
DIST_DIR=dist
GO=go

# Default target
help:
	@echo "lazy-bb Makefile targets:"
	@echo "  make build    - Build the application to dist folder"
	@echo "  make clean    - Remove dist folder and build artifacts"
	@echo "  make run      - Build and run the application"
	@echo "  make help     - Show this help message"

# Build target
build:
	@echo "🔨 Building $(BINARY_NAME)..."
	@mkdir -p $(DIST_DIR)
	@$(GO) build -o $(DIST_DIR)/$(BINARY_NAME)
	@echo "✓ Build complete: $(DIST_DIR)/$(BINARY_NAME)"

# Clean target
clean:
	@echo "🧹 Cleaning build artifacts..."
	@rm -rf $(DIST_DIR)
	@$(GO) clean
	@echo "✓ Clean complete"

# Run target
run: build
	@echo "🚀 Running $(BINARY_NAME)..."
	@./$(DIST_DIR)/$(BINARY_NAME)
