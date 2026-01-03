# Makefile for ActiveLog Module Development

.PHONY: all build test clean help

# Default target
all: build

# Build module
build:
	@echo "[BUILD] Building WASM module..."
	@./build-module.sh

# Run tests
test:
	@echo "[TEST] Running tests..."
	@./test-module.sh

# Register module
register: build
	@echo "[REGISTER] Registering module..."
	@./register-module.sh

# Clean build artifacts
clean:
	@echo "[CLEAN] Cleaning build artifacts..."
	@cargo clean
	@rm -f *.wasm *.wasm.opt

# Install dependencies
deps:
	@echo "[DEPS] Installing dependencies..."
	@rustup target add wasm32-unknown-unknown
	@cargo install cargo-wasi

# Help
help:
	@echo "ActiveLog Module Development"
	@echo ""
	@echo "Targets:"
	@echo "  make         - Build the module"
	@echo "  make test    - Run tests"
	@echo "  make register - Build and register the module"
	@echo "  make clean   - Remove build artifacts"
	@echo "  make deps    - Install development dependencies"
	@echo "  make help    - Show this help message"
	@echo ""
	@echo "Creating new modules:"
	@echo "  ./create-module.sh <name> [parser|detector|generator]"
