#!/bin/bash
# Docker Cleanup Script for LSI Ecosystem
# Removes old images, containers, and volumes

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

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

# Confirm
echo -e "${RED}This will remove all LSI Docker resources!${NC}"
read -p "Are you sure? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

log_info "Stopping and removing containers..."
docker-compose down -v 2>/dev/null || true
docker-compose -f docker-compose.prod.yml down -v 2>/dev/null || true

log_info "Removing LSI images..."
docker images --format '{{.Repository}}:{{.Tag}}' | grep '^lsi' | xargs -r docker rmi -f
docker images --format '{{.Repository}}:{{.Tag}}' | grep '^lsictl' | xargs -r docker rmi -f

log_info "Removing dangling images..."
docker image prune -f

log_info "Removing unused volumes..."
docker volume prune -f

log_info "Removing unused networks..."
docker network prune -f

log_info "System cleanup..."
docker system prune -f

log_success "Cleanup complete!"
echo ""
log_info "Docker disk usage:"
docker system df
