#!/bin/bash

# Documentation Generation Script for Aequor Platform
# Generates TypeDoc API documentation for all packages

set -e

echo "🚀 Generating API Documentation for Aequor Platform..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Array of packages to document
PACKAGES=(
  "protocol"
  "cascade"
  "privacy"
  "superinstance"
  "performance-optimizer"
)

# Base directory
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGES_DIR="$BASE_DIR/packages"

# Check if typedoc is installed
if ! command -v typedoc &> /dev/null; then
  echo "📦 Installing TypeDoc and plugins..."
  npm install --save-dev typedoc typedoc-plugin-markdown typedoc-plugin-mermaid
fi

# Function to generate docs for a package
generate_docs() {
  local pkg=$1
  local pkg_dir="$PACKAGES_DIR/$pkg"

  echo -e "${BLUE}Generating docs for @lsi/$pkg...${NC}"

  # Check if package exists
  if [ ! -d "$pkg_dir" ]; then
    echo -e "${YELLOW}⚠️  Package $pkg not found, skipping...${NC}"
    return
  fi

  # Check if typedoc.json exists
  if [ ! -f "$pkg_dir/typedoc.json" ]; then
    echo -e "${YELLOW}⚠️  No typedoc.json found for $pkg, skipping...${NC}"
    return
  fi

  # Check if package has src directory
  if [ ! -d "$pkg_dir/src" ]; then
    echo -e "${YELLOW}⚠️  No src directory found for $pkg, skipping...${NC}"
    return
  fi

  # Generate docs
  cd "$pkg_dir"
  npx typedoc --options typedoc.json || {
    echo -e "${YELLOW}⚠️  Failed to generate docs for $pkg${NC}"
    cd "$BASE_DIR"
    return
  }
  cd "$BASE_DIR"

  echo -e "${GREEN}✅ Generated docs for @lsi/$pkg${NC}"
}

# Generate docs for all packages
for pkg in "${PACKAGES[@]}"; do
  generate_docs "$pkg"
done

echo ""
echo -e "${GREEN}🎉 Documentation generation complete!${NC}"
echo ""
echo "📚 Generated documentation:"
for pkg in "${PACKAGES[@]}"; do
  if [ -d "$PACKAGES_DIR/$pkg/docs/api" ]; then
    echo "  • $PACKAGES_DIR/$pkg/docs/api"
  fi
done

echo ""
echo "💡 To serve documentation locally, run:"
echo "   npx http-server packages/[package-name]/docs/api"
echo ""
