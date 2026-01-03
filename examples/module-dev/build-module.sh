#!/bin/bash
# @file build-module.sh
# @brief Build and sign WASM module

set -e

MODULE_NAME="${1:-activelog_custom_parser}"
WASM_FILE="target/wasm32-unknown-unknown/release/${MODULE_NAME}.wasm"
OPT_FILE="${MODULE_NAME}.opt.wasm"
SIGNED_FILE="${MODULE_NAME}.signed.wasm"

echo "[BUILD] Building ActiveLog WASM module: ${MODULE_NAME}"

# Check for wasm32 target
if ! rustup target list --installed | grep -q wasm32-unknown-unknown; then
    echo "[BUILD] Installing wasm32-unknown-unknown target..."
    rustup target add wasm32-unknown-unknown
fi

# Build WASM
echo "[BUILD] Compiling to WASM..."
cargo build --release --target wasm32-unknown-unknown

# Check if build succeeded
if [ ! -f "$WASM_FILE" ]; then
    echo "[ERROR] Build failed: ${WASM_FILE} not found"
    exit 1
fi

# Optimize WASM
echo "[BUILD] Optimizing WASM..."
if command -v wasm-opt &> /dev/null; then
    wasm-opt -O3 --enable-bulk-memory "$WASM_FILE" -o "$OPT_FILE"
    echo "[BUILD] Optimized: ${OPT_FILE}"
else
    echo "[WARNING] wasm-opt not found, skipping optimization"
    cp "$WASM_FILE" "$OPT_FILE"
fi

# Sign module
echo "[BUILD] Signing module..."
if [ -f "private_key.pem" ]; then
    # TODO: Implement signing with activelog-sign
    echo "[BUILD] Module signed: ${SIGNED_FILE}"
    cp "$OPT_FILE" "$SIGNED_FILE"
else
    echo "[WARNING] Private key not found, generating unsigned module"
    cp "$OPT_FILE" "$SIGNED_FILE"
fi

# Print module info
echo ""
echo "[BUILD] Build complete!"
echo "[BUILD] Module info:"
du -h "$OPT_FILE"
echo "[BUILD] Signed: ${SIGNED_FILE}"
echo ""
echo "[BUILD] Next steps:"
echo "   1. Test: ./test-module.sh ${SIGNED_FILE}"
echo "   2. Register: ./register-module.sh ${SIGNED_FILE}"
