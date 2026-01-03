#!/bin/bash
# Docker Push Script for LSI Ecosystem
# Pushes built images to a container registry

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
REGISTRY="${DOCKER_REGISTRY:-docker.io}"
VERSION="${VERSION:-$(node -p "require('../package.json').version")}"
GIT_COMMIT="${GIT_COMMIT:-$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')}"

IMAGES=("lsi" "lsi-dev" "lsictl")

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if logged in
log_info "Checking Docker registry authentication..."
if ! docker info | grep -q "Username"; then
    log_error "Not logged in to Docker registry"
    log_info "Please run: docker login"
    exit 1
fi

# Push images
for IMAGE in "${IMAGES[@]}"; do
    FULL_NAME="${REGISTRY}/${IMAGE}"

    log_info "Pushing ${FULL_NAME}:${VERSION}..."
    if docker push "${FULL_NAME}:${VERSION}"; then
        log_success "Pushed ${FULL_NAME}:${VERSION}"
    else
        log_error "Failed to push ${FULL_NAME}:${VERSION}"
        exit 1
    fi

    log_info "Pushing ${FULL_NAME}:latest..."
    if docker push "${FULL_NAME}:latest"; then
        log_success "Pushed ${FULL_NAME}:latest"
    else
        log_error "Failed to push ${FULL_NAME}:latest"
        exit 1
    fi

    log_info "Pushing ${FULL_NAME}:${GIT_COMMIT}..."
    if docker push "${FULL_NAME}:${GIT_COMMIT}"; then
        log_success "Pushed ${FULL_NAME}:${GIT_COMMIT}"
    else
        log_error "Failed to push ${FULL_NAME}:${GIT_COMMIT}"
        exit 1
    fi
done

log_success "All images pushed successfully!"
