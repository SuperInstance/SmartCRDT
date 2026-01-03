#!/bin/bash
set -e

echo "Building SuperInstance WASM bindings (RELEASE)..."

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "wasm-pack not found. Installing..."
    cargo install wasm-pack
fi

# Build for web target with optimizations
wasm-pack build \
    --target web \
    --out-dir ../../packages/wasm/dist \
    --release

echo "✅ WASM release build complete!"
echo "Output: packages/wasm/dist/"
