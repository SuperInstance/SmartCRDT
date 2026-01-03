#!/bin/bash
# Repository Cleanup Safety Backup Script
# Creates timestamped backup before cleanup operations
# Usage: ./scripts/backup-before-cleanup.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DEMO_DIR="/mnt/c/users/casey/smartCRDT/demo"
BACKUP_DIR="/tmp"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="demo-backup-${TIMESTAMP}.tar.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"
LOG_FILE="/tmp/backup-${TIMESTAMP}.log"

echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Aequor Repository - Safety Backup Before Cleanup${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Timestamp: ${TIMESTAMP}"
echo "Source: ${DEMO_DIR}"
echo "Destination: ${BACKUP_PATH}"
echo ""

# Step 1: Verify source directory exists
echo -e "${YELLOW}[1/5] Verifying source directory...${NC}"
if [ ! -d "${DEMO_DIR}" ]; then
    echo -e "${RED}ERROR: Source directory ${DEMO_DIR} does not exist!${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Source directory verified${NC}"
echo ""

# Step 2: Calculate size before backup
echo -e "${YELLOW}[2/5] Calculating repository size...${NC}"
BEFORE_SIZE=$(du -sh "${DEMO_DIR}" | cut -f1)
echo "Current repository size: ${BEFORE_SIZE}"
echo ""

# Step 3: Create backup (excluding node_modules, build artifacts, and cache)
echo -e "${YELLOW}[3/5] Creating compressed backup...${NC}"
echo "This may take several minutes for large repositories..."
echo ""

# Create tarball with exclusions for speed and space
tar -czf "${BACKUP_PATH}" \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='dist-test' \
    --exclude='.turbo' \
    --exclude='*.log' \
    --exclude='.cache' \
    --exclude='coverage' \
    --exclude='*.tar.gz' \
    -C "/mnt/c/users/casey/smartCRDT" \
    demo 2>&1 | tee "${LOG_FILE}"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Backup created successfully${NC}"
else
    echo -e "${RED}✗ Backup creation failed! Check ${LOG_FILE}${NC}"
    exit 1
fi
echo ""

# Step 4: Verify backup integrity
echo -e "${YELLOW}[4/5] Verifying backup integrity...${NC}"
if gzip -t "${BACKUP_PATH}" 2>/dev/null; then
    echo -e "${GREEN}✓ Backup integrity verified${NC}"
else
    echo -e "${RED}✗ Backup integrity check failed!${NC}"
    exit 1
fi
echo ""

# Step 5: Report backup details
echo -e "${YELLOW}[5/5] Backup details:${NC}"
BACKUP_SIZE=$(du -sh "${BACKUP_PATH}" | cut -f1)
BACKUP_SIZE_BYTES=$(du -b "${BACKUP_PATH}" | cut -f1)
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Backup Complete${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo "Backup file:     ${BACKUP_PATH}"
echo "Backup size:     ${BACKUP_SIZE} (${BACKUP_SIZE_BYTES} bytes)"
echo "Repository size: ${BEFORE_SIZE}"
echo "Log file:        ${LOG_FILE}"
echo ""
echo -e "${YELLOW}To restore from backup if needed:${NC}"
echo "  tar -xzf ${BACKUP_PATH} -C /mnt/c/users/casey/smartCRDT/"
echo ""
echo -e "${GREEN}✓ You can now proceed with cleanup operations${NC}"
echo ""

# Create checksum for extra safety
CHECKSUM_FILE="${BACKUP_PATH}.sha256"
sha256sum "${BACKUP_PATH}" > "${CHECKSUM_FILE}"
echo "Checksum saved to: ${CHECKSUM_FILE}"
echo ""
