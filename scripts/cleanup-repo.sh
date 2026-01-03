#!/bin/bash
# Repository Cleanup Script
# Removes archives, old docs, and unnecessary files
# Usage: ./scripts/cleanup-repo.sh [--dry-run]

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEMO_DIR="/mnt/c/users/casey/smartCRDT/demo"
DRY_RUN=false

# Parse arguments
if [ "$1" == "--dry-run" ]; then
    DRY_RUN=true
    echo -e "${YELLOW}DRY RUN MODE - No files will be deleted${NC}"
    echo ""
fi

# Array of directories to remove
declare -a DIRS_TO_REMOVE=(
    "analysis"          # Old analysis files (consolidated elsewhere)
    "archive"           # Archived old code
    "archives"          # More archives
    "agents"            # Agent reports from old rounds
    "conversations"     # Chat logs
    "analytics"         # Old analytics (not production)
    "backups"           # Backup files
    "benchmarks"        # Old benchmarks (now in performance-optimizer)
    "bindings"          # Language bindings (not production-ready)
    "cartridges"        # Test cartridges (move to examples if needed)
    "cloud"             # Cloud configs (consolidate into docs if needed)
    "data"              # Local test data
    "database"          # Database configs (move to examples if needed)
    "papers"            # Old papers (consolidated into docs)
    "research"          # Old research
)

# Additional directories identified during scan
declare -a EXTRA_DIRS_TO_REMOVE=(
    "alertmanager"
    "benches"
    "cascadedev"
    "deploy"
    "design"
    "desktop"
    "edge"
    "examples-gallery"
    "examples-new"
    "feedback"
    "funding"
    "gaming"
    "grafana"
    "hypotheses"
    "k8s"
    "lsi"
    "manifests"
    "marketing"
    "marketplace"
    "mobile"
    "modules"
    "monitoring"
    "networking"
    "nginx"
    "operations"
    "packaging"
    "prometheus"
    "sales"
    "security"
    "test-backups"
    "test-checkpoints"
    "test-logs"
    "test-shadow-logs"
    "training"
    "tutorials"
    "vscode"
    "vscode-extension"
    "website-content"
    "docs-site"
    "RESEARCH_PACKAGE"
    "New folder"
)

# Build artifacts to remove
declare -a BUILD_ARTIFACTS=(
    "dist"
    "dist-test"
    ".turbo"
)

# Temporary files to remove
declare -a TEMP_PATTERNS=(
    "*.tmp"
    "*.test.ts.tmp"
    "*.swp"
    "*.bak"
    "*~"
)

echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Aequor Repository - Cleanup Script${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Working directory: ${DEMO_DIR}"
echo "Dry run: ${DRY_RUN}"
echo ""

# Change to demo directory
cd "${DEMO_DIR}" || exit 1

# Function to calculate size of a directory
calculate_size() {
    local path="$1"
    if [ -e "$path" ]; then
        du -sh "$path" 2>/dev/null | cut -f1
    else
        echo "0"
    fi
}

# Function to remove directory or file
remove_item() {
    local item="$1"
    local size=$(calculate_size "$item")

    if [ -e "$item" ]; then
        if [ "$DRY_RUN" = true ]; then
            echo -e "${BLUE}[DRY RUN]${NC} Would remove: ${item} (${size})"
        else
            echo -e "${YELLOW}Removing:${NC} ${item} (${size})"
            rm -rf "$item"
        fi
    else
        echo -e "${YELLOW}Skipped (not found):${NC} ${item}"
    fi
}

# Calculate total space before cleanup
TOTAL_BEFORE=$(du -sh . 2>/dev/null | cut -f1)
echo -e "${YELLOW}Current repository size:${NC} ${TOTAL_BEFORE}"
echo ""

# Step 1: Remove archives and old directories
echo -e "${YELLOW}[1/4] Removing archives and old directories...${NC}"
echo ""

for dir in "${DIRS_TO_REMOVE[@]}"; do
    remove_item "$dir"
done

echo ""
echo -e "${YELLOW}[2/4] Removing additional non-essential directories...${NC}"
echo ""

for dir in "${EXTRA_DIRS_TO_REMOVE[@]}"; do
    remove_item "$dir"
done

echo ""
echo -e "${YELLOW}[3/4] Removing build artifacts...${NC}"
echo ""

for artifact in "${BUILD_ARTIFACTS[@]}"; do
    if [[ "$artifact" == *"*"* ]]; then
        # Pattern with wildcard
        if [ "$DRY_RUN" = true ]; then
            echo -e "${BLUE}[DRY RUN]${NC} Would remove files matching: ${artifact}"
        else
            echo -e "${YELLOW}Removing files matching:${NC} ${artifact}"
            find . -name "$artifact" -type f -delete 2>/dev/null || true
            find . -name "$artifact" -type d -exec rm -rf {} + 2>/dev/null || true
        fi
    else
        remove_item "$artifact"
    fi
done

echo ""
echo -e "${YELLOW}[4/4] Removing temporary files...${NC}"
echo ""

for pattern in "${TEMP_PATTERNS[@]}"; do
    if [ "$DRY_RUN" = true ]; then
        COUNT=$(find . -name "$pattern" -type f 2>/dev/null | wc -l)
        echo -e "${BLUE}[DRY RUN]${NC} Would remove ${COUNT} files matching: ${pattern}"
    else
        COUNT=$(find . -name "$pattern" -type f 2>/dev/null | wc -l)
        if [ "$COUNT" -gt 0 ]; then
            echo -e "${YELLOW}Removing ${COUNT} files matching:${NC} ${pattern}"
            find . -name "$pattern" -type f -delete 2>/dev/null || true
        fi
    fi
done

echo ""
echo -e "${YELLOW}Removing .agent-reports directory...${NC}"
remove_item ".agent-reports"

echo ""
echo -e "${YELLOW}Removing old agent report files...${NC}"
for f in AGENT_*.md AGENT_ROUND_*.md *.AGENT_REPORT.md; do
    if [ -f "$f" ]; then
        remove_item "$f"
    fi
done

# Calculate space after cleanup
if [ "$DRY_RUN" = false ]; then
    TOTAL_AFTER=$(du -sh . 2>/dev/null | cut -f1)
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  Cleanup Complete${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}Repository size before:${NC} ${TOTAL_BEFORE}"
    echo -e "${YELLOW}Repository size after:${NC}  ${TOTAL_AFTER}"
    echo ""
    echo -e "${GREEN}✓ Cleanup completed successfully${NC}"
else
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  Dry Run Complete${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}Repository size:${NC} ${TOTAL_BEFORE}"
    echo ""
    echo -e "${BLUE}Run without --dry-run to execute cleanup${NC}"
fi
echo ""
