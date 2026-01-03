#!/bin/bash
#
# feature.sh - Create a new feature branch
#
# Usage: ./scripts/git/feature.sh <ticket-id> <feature-description>
# Example: ./scripts/git/feature.sh 452 routing-optimization
#
# This script creates a new feature branch from develop with proper naming
# and sets up the branch for development.
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Not a git repository"
    exit 1
fi

# Check arguments
if [ $# -lt 2 ]; then
    print_error "Usage: $0 <ticket-id> <feature-description>"
    echo ""
    echo "Examples:"
    echo "  $0 452 routing-optimization"
    echo "  $0 501 memory-leak-fix"
    echo "  503 security-patch"
    exit 1
fi

TICKET_ID=$1
FEATURE_DESC=$2

# Generate branch name
BRANCH_NAME="feature/${TICKET_ID}-${FEATURE_DESC}"

# Convert to lowercase and replace spaces with hyphens
BRANCH_NAME=$(echo "$BRANCH_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')

# Check if branch already exists
if git show-ref --verify --quiet refs/heads/"$BRANCH_NAME"; then
    print_error "Branch '$BRANCH_NAME' already exists"
    echo ""
    echo "Switch to existing branch:"
    echo "  git checkout $BRANCH_NAME"
    exit 1
fi

# Check if develop branch exists
if ! git show-ref --verify --quiet refs/heads/develop; then
    print_warning "Develop branch not found locally. Fetching from remote..."
    git fetch origin develop
fi

print_info "Creating feature branch: $BRANCH_NAME"
echo ""

# Switch to develop and update
print_info "Switching to develop branch..."
git checkout develop 2>/dev/null || git checkout -b develop origin/develop
print_success "Checked out develop"

# Pull latest changes
print_info "Pulling latest changes from origin/develop..."
git pull origin develop
print_success "Updated develop branch"

# Create and checkout feature branch
print_info "Creating feature branch: $BRANCH_NAME"
git checkout -b "$BRANCH_NAME"
print_success "Created and checked out: $BRANCH_NAME"

echo ""
print_success "Feature branch created successfully!"
echo ""
echo "Branch name: $BRANCH_NAME"
echo "Base branch: develop"
echo ""
echo "Next steps:"
echo "  1. Make your changes"
echo "  2. Commit your changes:"
echo "     git add ."
echo "     git commit -m 'feat: describe your changes'"
echo "  3. Push to remote:"
echo "     git push -u origin $BRANCH_NAME"
echo "  4. Create pull request on GitHub"
echo ""
print_info "Ready for development!"
