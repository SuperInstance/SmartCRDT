#!/bin/bash

# Build script for Rust native modules
# This script compiles Rust crates and generates TypeScript bindings

set -e

NATIVE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FFI_DIR="$NATIVE_DIR/ffi"

echo "Building SuperInstance native modules..."
echo

# Ensure cargo is available
if ! command -v cargo &> /dev/null; then
    echo "Error: cargo not found. Please install Rust from https://rustup.rs/"
    exit 1
fi

# Build the workspace
echo "Building Rust workspace..."
cd "$NATIVE_DIR"
cargo build --release
echo "✓ Build successful"
echo

# Check if index.js was generated
if [ -f "$FFI_DIR/index.js" ]; then
    echo "✓ TypeScript bindings generated"
else
    echo "⚠ Warning: index.js not found. FFI bindings may not have been generated."
fi

echo
echo "Build complete!"
echo "Native modules available in: $FFI_DIR"
