#!/bin/bash
#
# release.sh - Create a new release branch
#
# Usage: ./scripts/git/release.sh <version>
# Example: ./scripts/git/release.sh 1.0.0
#
# This script creates a new release branch from develop with proper naming
# and prepares it for release.
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
if [ $# -lt 1 ]; then
    print_error "Usage: $0 <version>"
    echo ""
    echo "Version format: MAJOR.MINOR.PATCH"
    echo ""
    echo "Examples:"
    echo "  $0 1.0.0"
    echo "  $0 1.1.0"
    echo "  $0 2.0.0"
    exit 1
fi

VERSION=$1

# Validate version format (semantic versioning)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    print_error "Invalid version format: $VERSION"
    echo ""
    echo "Version must follow semantic versioning: MAJOR.MINOR.PATCH"
    echo "Example: 1.0.0"
    exit 1
fi

BRANCH_NAME="release/$VERSION"

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

print_info "Creating release branch: $BRANCH_NAME for version $VERSION"
echo ""

# Switch to develop and update
print_info "Switching to develop branch..."
git checkout develop 2>/dev/null || git checkout -b develop origin/develop
print_success "Checked out develop"

# Pull latest changes
print_info "Pulling latest changes from origin/develop..."
git pull origin develop
print_success "Updated develop branch"

# Create and checkout release branch
print_info "Creating release branch: $BRANCH_NAME"
git checkout -b "$BRANCH_NAME"
print_success "Created and checked out: $BRANCH_NAME"

echo ""
print_success "Release branch created successfully!"
echo ""
echo "Branch name: $BRANCH_NAME"
echo "Version: $VERSION"
echo "Base branch: develop"
echo ""
echo "Next steps:"
echo "  1. Update version numbers in package.json files:"
echo "     npm run version:bump $VERSION"
echo ""
echo "  2. Update CHANGELOG.md:"
echo "     - Add release date"
echo "     - Summarize changes"
echo "     - Add release notes"
echo ""
echo "  3. Commit version updates:"
echo "     git add ."
echo "     git commit -m 'chore: bump version to $VERSION'"
echo ""
echo "  4. Test the release:"
echo "     npm run build"
echo "     npm run test"
echo ""
echo "  5. Push release branch:"
echo "     git push -u origin $BRANCH_NAME"
echo ""
echo "  6. Create pull request to main"
echo ""
print_warning "Remember to merge back to develop after release!"
echo ""
print_info "Ready for release preparation!"
