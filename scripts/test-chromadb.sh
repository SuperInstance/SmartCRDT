#!/bin/bash

# ChromaDB Integration Test Runner
# Runs comprehensive tests for ChromaDB integration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "======================================"
echo "ChromaDB Integration Test Runner"
echo "======================================"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: docker-compose is not installed${NC}"
    echo "Please install Docker Compose first: https://docs.docker.com/compose/install/"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Warning: .env file not found${NC}"
    echo "Creating .env from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}Created .env file${NC}"
    else
        echo -e "${RED}Error: .env.example not found${NC}"
        exit 1
    fi
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Start ChromaDB if not running
echo "Starting ChromaDB..."
docker-compose -f docker-compose.chromadb.yml up -d chromadb

# Wait for ChromaDB to be healthy
echo "Waiting for ChromaDB to be ready..."
timeout=60
elapsed=0
while [ $elapsed -lt $timeout ]; do
    if curl -s http://localhost:${CHROMA_PORT:-8000}/api/v1/heartbeat > /dev/null 2>&1; then
        echo -e "${GREEN}ChromaDB is ready!${NC}"
        break
    fi
    sleep 2
    elapsed=$((elapsed + 2))
done

if [ $elapsed -ge $timeout ]; then
    echo -e "${RED}Timeout waiting for ChromaDB${NC}"
    echo "Check logs with: docker-compose -f docker-compose.chromadb.yml logs"
    exit 1
fi

echo ""
echo "Running tests..."
echo ""

# Run tests
if [ -f package.json ] && grep -q "test" package.json; then
    # Run specific test file
    if [ -f "packages/core/src/vectordb/__tests__/chromadb.integration.test.ts" ]; then
        npx vitest run packages/core/src/vectordb/__tests__/chromadb.integration.test.ts
    else
        # Run all tests
        npm test
    fi
else
    echo -e "${YELLOW}No test script found in package.json${NC}"
    echo "Running manual test..."

    # Create a simple test script
    cat > /tmp/chromadb-test.js << 'EOF'
import { ChromaDbAdapterEnhanced } from './packages/core/dist/vectordb/ChromaDbAdapter.enhanced.js';

async function test() {
  const adapter = new ChromaDbAdapterEnhanced({
    host: process.env.CHROMA_HOST || 'localhost',
    port: parseInt(process.env.CHROMA_PORT || '8000'),
    collectionName: 'test-collection',
    enableMetrics: true,
  });

  try {
    console.log('Testing ChromaDB connection...');
    const isHealthy = await adapter.healthCheck();
    console.log(`Health check: ${isHealthy ? 'OK' : 'FAILED'}`);

    if (isHealthy) {
      console.log('\nAdding test documents...');
      await adapter.addDocuments([
        {
          id: 'test-1',
          vector: new Float32Array([1, 0, 0]),
          content: 'Test document 1',
        },
        {
          id: 'test-2',
          vector: new Float32Array([0, 1, 0]),
          content: 'Test document 2',
        },
      ]);

      console.log('Searching for similar documents...');
      const results = await adapter.search(new Float32Array([1, 0, 0]), 1);
      console.log(`Found ${results.length} results`);

      console.log('\nGetting statistics...');
      const stats = await adapter.getStats();
      console.log(`Total documents: ${stats.documentCount}`);

      console.log('\nCleaning up...');
      await adapter.clear();

      console.log('\n✓ All tests passed!');
    }
  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    process.exit(1);
  } finally {
    await adapter.close();
  }
}

test();
EOF

    node /tmp/chromadb-test.js
fi

echo ""
echo "======================================"
echo "Test Summary"
echo "======================================"

# Show ChromaDB logs
echo ""
echo "ChromaDB logs:"
docker-compose -f docker-compose.chromadb.yml logs --tail=20 chromadb

# Show statistics
echo ""
echo "ChromaDB statistics:"
echo "Documents: $(curl -s http://localhost:${CHROMA_PORT:-8000}/api/v1/collections)"

echo ""
echo -e "${GREEN}Tests completed!${NC}"
echo ""
echo "To stop ChromaDB, run:"
echo "  docker-compose -f docker-compose.chromadb.yml down"
echo ""
echo "To view logs, run:"
echo "  docker-compose -f docker-compose.chromadb.yml logs -f chromadb"
echo ""
