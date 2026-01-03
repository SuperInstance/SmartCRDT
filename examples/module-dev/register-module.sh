#!/bin/bash
# @file register-module.sh
# @brief Register WASM module with ActiveLog

set -e

MODULE="${1:-activelog_custom_parser.signed.wasm}"
MODULE_TYPE="${2:-parser}"
MODULE_NAME="${3:-custom_parser}"

echo "[REGISTER] Registering module with ActiveLog"
echo "[REGISTER] Module: ${MODULE}"
echo "[REGISTER] Type: ${MODULE_TYPE}"
echo "[REGISTER] Name: ${MODULE_NAME}"

if [ ! -f "$MODULE" ]; then
    echo "[ERROR] Module not found: ${MODULE}"
    exit 1
fi

# Create modules directory
mkdir -p ~/.activelog/modules

# Copy module
cp "$MODULE" ~/.activelog/modules/${MODULE_NAME}.wasm

# TODO: Implement activelog-register
echo "[REGISTER] Module registered: ${MODULE_NAME}"
echo "[REGISTER] Location: ~/.activelog/modules/${MODULE_NAME}.wasm"

echo ""
echo "[REGISTER] To use this module:"
echo "   activelog --module ${MODULE_NAME}"
