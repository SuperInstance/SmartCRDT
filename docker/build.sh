#!/bin/bash
# Docker Build Script for LSI Ecosystem
# This script builds, tags, and optionally pushes Docker images

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
REGISTRY="${DOCKER_REGISTRY:-docker.io/lsi-ecosystem}"
VERSION="${VERSION:-$(node -p "require('$PROJECT_ROOT/package.json').version")}"
GIT_COMMIT="${GIT_COMMIT:-$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')}"
BUILD_DATE="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"

# Parse arguments
PUSH=false
CLEAN=false
DEV=false
CLI=false
ALL=true

while [[ $# -gt 0 ]]; do
    case $1 in
        --push)
            PUSH=true
            shift
            ;;
        --clean)
            CLEAN=true
            shift
            ;;
        --dev)
            DEV=true
            ALL=false
            shift
            ;;
        --cli)
            CLI=true
            ALL=false
            shift
            ;;
        --prod)
            # Default, build production
            shift
            ;;
        --all)
            ALL=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --all       Build all images (default)"
            echo "  --dev       Build development image only"
            echo "  --cli       Build CLI image only"
            echo "  --prod      Build production image only"
            echo "  --push      Push images to registry after building"
            echo "  --clean     Remove old images before building"
            echo "  -h, --help  Show this help message"
            echo ""
            echo "Environment Variables:"
            echo "  DOCKER_REGISTRY  Docker registry (default: docker.io/lsi-ecosystem)"
            echo "  VERSION          Version tag (default: from package.json)"
            echo "  GIT_COMMIT       Git commit hash (default: git rev-parse --short HEAD)"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

build_image() {
    local name=$1
    local dockerfile=$2
    local tag="${REGISTRY}/${name}:${VERSION}"
    local tag_latest="${REGISTRY}/${name}:latest"
    local tag_commit="${REGISTRY}/${name}:${GIT_COMMIT}"

    log_info "Building ${name}..."

    # Build arguments
    BUILD_ARGS=(
        --build-arg "VERSION=${VERSION}"
        --build-arg "BUILD_DATE=${BUILD_DATE}"
        --build-arg "GIT_COMMIT=${GIT_COMMIT}"
    )

    # Build image
    docker build \
        "${BUILD_ARGS[@]}" \
        -f "${PROJECT_ROOT}/${dockerfile}" \
        -t "${tag}" \
        -t "${tag_latest}" \
        -t "${tag_commit}" \
        "${PROJECT_ROOT}" || {
        echo -e "${RED}Failed to build ${name}${NC}"
        exit 1
    }

    log_success "Built ${name} -> ${tag}"

    # Push if requested
    if [ "$PUSH" = true ]; then
        log_info "Pushing ${name} to registry..."
        docker push "${tag}"
        docker push "${tag_latest}"
        docker push "${tag_commit}"
        log_success "Pushed ${name}"
    fi
}

clean_old_images() {
    log_info "Cleaning old images..."
    docker image prune -f --filter "label=lsi-ecosystem"
    log_success "Cleaned old images"
}

# Main
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}LSI Ecosystem Docker Build${NC}"
echo -e "${BLUE}========================================${NC}"
echo "Version: ${VERSION}"
echo "Git Commit: ${GIT_COMMIT}"
echo "Build Date: ${BUILD_DATE}"
echo "Registry: ${REGISTRY}"
echo ""

cd "$PROJECT_ROOT"

# Clean if requested
if [ "$CLEAN" = true ]; then
    clean_old_images
fi

# Build images
if [ "$ALL" = true ] || [ "$DEV" = false ] && [ "$CLI" = false ]; then
    build_image "lsi" "Dockerfile"
fi

if [ "$ALL" = true ] || [ "$DEV" = true ]; then
    build_image "lsi-dev" "Dockerfile.dev"
fi

if [ "$ALL" = true ] || [ "$CLI" = true ]; then
    build_image "lsictl" "Dockerfile.cli"
fi

echo ""
log_success "Build complete!"
echo ""
echo "Images built:"
echo "  - ${REGISTRY}/lsi:${VERSION}"
[ "$ALL" = true ] || [ "$DEV" = true ] && echo "  - ${REGISTRY}/lsi-dev:${VERSION}"
[ "$ALL" = true ] || [ "$CLI" = true ] && echo "  - ${REGISTRY}/lsictl:${VERSION}"
echo ""
echo "To run containers:"
echo "  docker run -p 3000:3000 ${REGISTRY}/lsi:${VERSION}"
echo "  docker-compose -f docker-compose.yml up"
echo "  docker-compose -f docker-compose.prod.yml up"
