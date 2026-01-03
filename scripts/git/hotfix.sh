#!/bin/bash
#
# hotfix.sh - Create a new hotfix branch
#
# Usage: ./scripts/git/hotfix.sh <ticket-id> <hotfix-description>
# Example: ./scripts/git/hotfix.sh 501 security-patch
#
# This script creates a new hotfix branch from main with proper naming
# and sets up the branch for urgent fixes.
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
    print_error "Usage: $0 <ticket-id> <hotfix-description>"
    echo ""
    echo "Examples:"
    echo "  $0 501 security-patch"
    echo "  $0 502 memory-leak-fix"
    echo "  $0 503 critical-bug-fix"
    exit 1
fi

TICKET_ID=$1
HOTFIX_DESC=$2

# Generate branch name
BRANCH_NAME="hotfix/${TICKET_ID}-${HOTFIX_DESC}"

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

# Check if main branch exists
if ! git show-ref --verify --quiet refs/heads/main; then
    print_warning "Main branch not found locally. Fetching from remote..."
    git fetch origin main
fi

print_info "Creating hotfix branch: $BRANCH_NAME"
echo ""

# Switch to main and update
print_info "Switching to main branch..."
git checkout main 2>/dev/null || git checkout -b main origin/main
print_success "Checked out main"

# Pull latest changes
print_info "Pulling latest changes from origin/main..."
git pull origin main
print_success "Updated main branch"

# Get current version
CURRENT_VERSION=$(git describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
print_info "Current version: $CURRENT_VERSION"

# Create and checkout hotfix branch
print_info "Creating hotfix branch: $BRANCH_NAME"
git checkout -b "$BRANCH_NAME"
print_success "Created and checked out: $BRANCH_NAME"

echo ""
print_success "Hotfix branch created successfully!"
echo ""
echo "Branch name: $BRANCH_NAME"
echo "Base branch: main"
echo "Base version: $CURRENT_VERSION"
echo ""
echo "Next steps:"
echo "  1. Implement the fix"
echo ""
echo "  2. Test the fix thoroughly:"
echo "     npm run build"
echo "     npm run test"
echo ""
echo "  3. Commit your changes:"
echo "     git add ."
echo "     git commit -m 'fix: describe the hotfix'"
echo ""
echo "  4. Push to remote:"
echo "     git push -u origin $BRANCH_NAME"
echo ""
echo "  5. Create pull request to BOTH main AND develop"
echo ""
echo "  6. After merging to main, create a new tag:"
echo "     git checkout main"
echo "     git tag -a <new-version> -m 'Hotfix <new-version>'"
echo "     git push origin --tags"
echo ""
echo "  7. Merge hotfix back to develop:"
echo "     git checkout develop"
echo "     git merge $BRANCH_NAME"
echo "     git push origin develop"
echo ""
print_warning "Hotfixes should be completed quickly (hours, not days)!"
print_warning "Remember to merge to BOTH main AND develop!"
echo ""
print_info "Ready for hotfix!"
