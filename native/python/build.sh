#!/bin/bash
# Build script for Python bindings using Maturin

set -e

echo "================================"
echo "Building SuperInstance Python Bindings"
echo "================================"
echo ""

# Check if maturin is installed
if ! command -v maturin &> /dev/null; then
    echo "Maturin not found. Installing..."
    pip install maturin
fi

# Parse arguments
BUILD_TYPE=${1:-release}  # 'debug' or 'release'

if [ "$BUILD_TYPE" = "debug" ]; then
    echo "Building in DEBUG mode..."
    maturin develop
else
    echo "Building in RELEASE mode..."
    maturin develop --release
fi

echo ""
echo "================================"
echo "Build complete!"
echo "================================"
echo ""
echo "To build a wheel for distribution:"
echo "  maturin build --release"
echo ""
echo "To test the Python bindings:"
echo "  cd ../python"
echo "  python -c 'import superinstance; print(superinstance.__version__)'"
echo ""
