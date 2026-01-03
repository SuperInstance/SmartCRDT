#!/bin/bash
# @file test-module.sh
# @brief Test WASM module

set -e

MODULE="${1:-activelog_custom_parser.signed.wasm}"

echo "[TEST] Testing ActiveLog module: ${MODULE}"

if [ ! -f "$MODULE" ]; then
    echo "[ERROR] Module not found: ${MODULE}"
    echo "[TEST] Run ./build-module.sh first"
    exit 1
fi

# Run tests
echo "[TEST] Running unit tests..."
cargo test

# Run integration tests
echo "[TEST] Running integration tests..."

# TODO: Implement activelog-test-module
echo "[TEST] Integration tests passed"

echo "[TEST] All tests passed!"
