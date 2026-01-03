#!/bin/bash
# ============================================================================
# Aequor Docker Build Script
# ============================================================================
# Builds all Aequor package Docker images with optimizations

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
REGISTRY="${REGISTRY:-aequor}"
VERSION="${VERSION:-4.0.0}"
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUSH="${PUSH:-false}"
DEV="${DEV:-false}"
CACHE="${CACHE:-auto}"

# Build arguments
BUILD_ARGS=""
if [ "$DEV" = "true" ]; then
    VERSION="${VERSION}-dev"
    BUILD_ARGS="--target development"
fi

# Packages to build
PACKAGES=(
    "protocol"
    "cascade"
    "privacy"
    "superinstance"
    "performance-optimizer"
    "security-audit"
    "sanitization"
    "cli"
)

# Function to build package
build_package() {
    local package=$1
    local package_dir="${BASE_DIR}/packages/${package}"

    if [ ! -d "$package_dir" ]; then
        echo -e "${RED}✗ Package directory not found: ${package}${NC}"
        return 1
    fi

    echo -e "${BLUE}Building ${package}...${NC}"

    # Build arguments
    local docker_args=(
        build
        --tag "${REGISTRY}/${package}:${VERSION}"
        --tag "${REGISTRY}/${package}:latest"
        --file "${package_dir}/Dockerfile"
        --build-arg "VERSION=${VERSION}"
        --build-arg "BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
        --build-arg "VCS_REF=$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
        --cache-from "${REGISTRY}/${package}:latest"
        --build-arg "BUILDKIT_INLINE_CACHE=1"
    )

    if [ "$CACHE" = "no" ]; then
        docker_args+=(--no-cache)
    fi

    docker_args+=("${package_dir}")

    # Execute build
    if docker "${docker_args[@]}" 2>&1 | while read -r line; do
        echo "  ${line}"
    done; then
        echo -e "${GREEN}✓ Built ${package}${NC}"

        # Push if requested
        if [ "$PUSH" = "true" ]; then
            echo -e "${BLUE}Pushing ${package}...${NC}"
            docker push "${REGISTRY}/${package}:${VERSION}"
            docker push "${REGISTRY}/${package}:latest"
            echo -e "${GREEN}✓ Pushed ${package}${NC}"
        fi

        # Show image size
        local size=$(docker images "${REGISTRY}/${package}:${VERSION}" --format "{{.Size}}")
        echo -e "  Size: ${size}"

        return 0
    else
        echo -e "${RED}✗ Failed to build ${package}${NC}"
        return 1
    fi
}

# Main build process
echo "=========================================="
echo "Aequor Docker Build Script"
echo "=========================================="
echo "Registry: ${REGISTRY}"
echo "Version: ${VERSION}"
echo "Push: ${PUSH}"
echo "Dev: ${DEV}"
echo "Cache: ${CACHE}"
echo "=========================================="
echo ""

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker not found. Please install Docker first.${NC}"
    exit 1
fi

# Build base image first
echo -e "${BLUE}Building base image...${NC}"
if [ -f "${BASE_DIR}/docker/Dockerfile.base" ]; then
    docker build \
        --tag "${REGISTRY}/base:${VERSION}" \
        --tag "${REGISTRY}/base:latest" \
        --file "${BASE_DIR}/docker/Dockerfile.base" \
        "${BASE_DIR}"
    echo -e "${GREEN}✓ Base image built${NC}"
else
    echo -e "${YELLOW}⚠ No base Dockerfile found, skipping${NC}"
fi
echo ""

# Build each package
success_count=0
fail_count=0

for package in "${PACKAGES[@]}"; do
    if build_package "$package"; then
        ((success_count++))
    else
        ((fail_count++))
    fi
    echo ""
done

# Summary
echo "=========================================="
echo "Build Summary"
echo "=========================================="
echo -e "Successful: ${GREEN}${success_count}${NC}"
echo -e "Failed: ${RED}${fail_count}${NC}"
echo "Total: $((success_count + fail_count))"
echo "=========================================="

if [ $fail_count -gt 0 ]; then
    exit 1
fi
