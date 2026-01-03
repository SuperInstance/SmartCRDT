#!/bin/bash

# Aequor v1.0.0 Tag Creation Script
# Usage: ./scripts/create-v1.0-tag.sh

set -e

echo "🚀 Starting Aequor v1.0.0 tag creation process..."

# Configuration
TAG_NAME="v1.0.0"
RELEASE_BRANCH="release/v1.0.0"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Pre-flight checks
log_info "Running pre-flight checks..."

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    log_error "Not in a git repository"
    exit 1
fi

# Check if we're on main branch
current_branch=$(git branch --show-current)
if [ "$current_branch" != "main" ]; then
    log_warn "Not on main branch (currently on $current_branch)"
    read -p "Switch to main branch? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git checkout main
        log_info "Switched to main branch"
    else
        log_error "Aborting: Please switch to main branch first"
        exit 1
    fi
fi

# Pull latest changes
log_info "Pulling latest changes..."
git pull origin main

# Check if tag already exists
if git tag -l "$TAG_NAME" | grep -q "$TAG_NAME"; then
    log_error "Tag $TAG_NAME already exists locally"
    read -p "Delete existing tag? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git tag -d "$TAG_NAME"
        log_info "Deleted local tag $TAG_NAME"
    else
        log_error "Aborting: Tag already exists"
        exit 1
    fi
fi

# Verify build
log_info "Verifying build..."
if ! npm run build; then
    log_error "Build failed"
    exit 1
fi

# Verify tests
log_info "Verifying tests..."
if ! npm test; then
    log_error "Tests failed"
    exit 1
fi

# Create tag
log_info "Creating tag $TAG_NAME..."
git tag -a "$TAG_NAME" -m "Release v1.0.0 - Production Ready

Aequor Cognitive Orchestration Platform - First Production Release

Changes:
- Cascade Router: Complexity-based routing with emotional intelligence
- Privacy Suite: Intent encoding and redaction protocol
- Performance Suite: Hardware-aware dispatch optimization
- Protocol Layer: Open ATP/ACP standards implementation
- Complete TypeScript implementation with 80%+ test coverage

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Verify tag
log_info "Verifying tag..."
if ! git tag -l "$TAG_NAME" | grep -q "$TAG_NAME"; then
    log_error "Tag creation failed"
    exit 1
fi

# Show tag
log_info "Tag details:"
git show "$TAG_NAME"

# Push tag
read -p "Push tag to remote? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_info "Pushing tag to remote..."
    git push origin "$TAG_NAME"
    log_info "Tag pushed successfully"
else
    log_warn "Tag not pushed. You can push later with: git push origin $TAG_NAME"
fi

# Create release branch
read -p "Create release branch $RELEASE_BRANCH? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_info "Creating release branch..."
    git checkout -b "$RELEASE_BRANCH"
    git push origin "$RELEASE_BRANCH"
    log_info "Release branch created and pushed"
else
    log_warn "Release branch not created"
fi

log_info "✅ Tag creation process completed successfully!"
echo ""
echo "Next steps:"
echo "1. Publish npm packages: npm publish"
echo "2. Create GitHub release"
echo "3. Update documentation"
echo "4. Announce to community"