#!/bin/bash
set -e

echo "Building SuperInstance WASM bindings..."

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "wasm-pack not found. Installing..."
    cargo install wasm-pack
fi

# Build for web target
wasm-pack build \
    --target web \
    --out-dir ../../packages/wasm/dist \
    --dev

echo "✅ WASM build complete!"
echo "Output: packages/wasm/dist/"
