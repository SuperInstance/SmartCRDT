#!/bin/bash
# ============================================================================
# Aequor Docker Push Script
# ============================================================================
# Pushes all Aequor package Docker images to registry

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
REGISTRY="${REGISTRY:-aequor}"
VERSION="${VERSION:-4.0.0}"

# Packages to push
PACKAGES=(
    "base"
    "protocol"
    "cascade"
    "privacy"
    "superinstance"
    "performance-optimizer"
    "security-audit"
    "sanitization"
    "cli"
)

# Function to push image
push_image() {
    local package=$1
    local image="${REGISTRY}/${package}:${VERSION}"
    local latest="${REGISTRY}/${package}:latest"

    echo -e "${BLUE}Pushing ${package}...${NC}"

    if docker push "$image" && docker push "$latest"; then
        echo -e "${GREEN}✓ Pushed ${package}${NC}"
        return 0
    else
        echo -e "${RED}✗ Failed to push ${package}${NC}"
        return 1
    fi
}

# Main push process
echo "=========================================="
echo "Aequor Docker Push Script"
echo "=========================================="
echo "Registry: ${REGISTRY}"
echo "Version: ${VERSION}"
echo "=========================================="
echo ""

# Check if logged in
if ! docker info &> /dev/null; then
    echo -e "${RED}✗ Cannot connect to Docker daemon${NC}"
    exit 1
fi

# Push each package
success_count=0
fail_count=0

for package in "${PACKAGES[@]}"; do
    if push_image "$package"; then
        ((success_count++))
    else
        ((fail_count++))
    fi
    echo ""
done

# Summary
echo "=========================================="
echo "Push Summary"
echo "=========================================="
echo -e "Successful: ${GREEN}${success_count}${NC}"
echo -e "Failed: ${RED}${fail_count}${NC}"
echo "Total: $((success_count + fail_count))"
echo "=========================================="

if [ $fail_count -gt 0 ]; then
    exit 1
fi
