#!/bin/bash

# LSI Monitoring Setup Script
# This script sets up Prometheus, Grafana, and AlertManager for LSI monitoring

set -e

echo "==================================="
echo "LSI Monitoring Setup"
echo "==================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "Error: Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo -e "${GREEN}Starting monitoring services...${NC}"
echo ""

# Start monitoring stack with docker-compose
docker-compose -f docker-compose.monitoring.yml up -d

echo ""
echo -e "${GREEN}Monitoring services started!${NC}"
echo ""
echo "==================================="
echo "Access URLs:"
echo "==================================="
echo "Prometheus:  http://localhost:9090"
echo "Grafana:     http://localhost:3001 (admin/admin)"
echo "AlertManager: http://localhost:9093"
echo ""
echo "==================================="
echo "Next Steps:"
echo "==================================="
echo "1. Import Grafana dashboards from ./grafana/*.json"
echo "2. Add Prometheus as a data source in Grafana"
echo "3. Start the LSI server: lsictl serve"
echo "4. Verify metrics: curl http://localhost:3000/metrics"
echo ""
echo "For more information, see docs/MONITORING.md"
echo ""
