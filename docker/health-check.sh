#!/bin/bash
# ============================================================================
# Aequor Health Check Script
# ============================================================================
# Performs comprehensive health checks on all Aequor services

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SERVICES=("protocol" "cascade" "privacy" "superinstance" "performance" "security" "sanitization" "cli")
INFRASTRUCTURE=("postgres" "redis" "chroma" "ollama")
OBSERVABILITY=("prometheus" "grafana" "jaeger")

# Function to check service health
check_service() {
    local service=$1
    local container_name="aequor-${service}"

    echo -n "Checking ${service}... "

    if docker ps | grep -q "${container_name}"; then
        # Check if container is healthy
        health_status=$(docker inspect --format='{{.State.Health.Status}}' "${container_name}" 2>/dev/null || echo "no-healthcheck")

        if [ "$health_status" = "healthy" ] || [ "$health_status" = "no-healthcheck" ]; then
            echo -e "${GREEN}✓ Running${NC}"
            return 0
        else
            echo -e "${YELLOW}⚠ Unhealthy (${health_status})${NC}"
            return 1
        fi
    else
        echo -e "${RED}✗ Not running${NC}"
        return 1
    fi
}

# Function to check port connectivity
check_port() {
    local host=$1
    local port=$2
    local name=$3

    echo -n "Checking ${name} (${host}:${port})... "

    if timeout 2 bash -c "cat < /dev/null > /dev/tcp/${host}/${port}" 2>/dev/null; then
        echo -e "${GREEN}✓ Accessible${NC}"
        return 0
    else
        echo -e "${RED}✗ Not accessible${NC}"
        return 1
    fi
}

# Main health check
echo "=========================================="
echo "Aequor Platform Health Check"
echo "=========================================="
echo ""

# Check Aequor services
echo "Aequor Services:"
echo "----------------"
for service in "${SERVICES[@]}"; do
    check_service "$service"
done
echo ""

# Check Infrastructure
echo "Infrastructure:"
echo "---------------"
for service in "${INFRASTRUCTURE[@]}"; do
    check_service "$service"
done
echo ""

# Check Observability
echo "Observability:"
echo "--------------"
for service in "${OBSERVABILITY[@]}"; do
    check_service "$service"
done
echo ""

# Check key ports
echo "Port Connectivity:"
echo "------------------"
check_port "localhost" "3000" "Cascade Router"
check_port "localhost" "3001" "Privacy Suite"
check_port "localhost" "3002" "SuperInstance"
check_port "localhost" "9090" "Cascade Metrics"
check_port "localhost" "5432" "PostgreSQL"
check_port "localhost" "6379" "Redis"
check_port "localhost" "8000" "ChromaDB"
check_port "localhost" "11434" "Ollama"
check_port "localhost" "9092" "Prometheus"
echo ""

# Summary
echo "=========================================="
echo "Health check complete!"
echo "=========================================="
