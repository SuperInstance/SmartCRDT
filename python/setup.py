#!/usr/bin/env python3
"""
Setup script for SuperInstance Python package.
"""

from pathlib import Path
import subprocess
import sys


def check_dependencies():
    """Check if required dependencies are installed."""
    print("Checking dependencies...")

    # Check Rust
    try:
        result = subprocess.run(
            ["rustc", "--version"],
            capture_output=True,
            text=True,
            check=True,
        )
        print(f"  ✓ Rust: {result.stdout.strip()}")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("  ✗ Rust not found. Please install from https://rustup.rs/")
        return False

    # Check Python version
    if sys.version_info < (3, 8):
        print(f"  ✗ Python {sys.version} not supported. Requires Python 3.8+")
        return False
    print(f"  ✓ Python: {sys.version}")

    # Check maturin
    try:
        result = subprocess.run(
            ["maturin", "--version"],
            capture_output=True,
            text=True,
            check=True,
        )
        print(f"  ✓ Maturin: {result.stdout.strip()}")
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("  ✗ Maturin not found. Installing...")
        subprocess.run([sys.executable, "-m", "pip", "install", "maturin"], check=True)

    return True


def build_native():
    """Build native Rust extension."""
    print("\nBuilding native extension...")

    native_dir = Path(__file__).parent.parent / "native" / "python"

    if not native_dir.exists():
        print(f"  ✗ Native directory not found: {native_dir}")
        return False

    build_script = native_dir / "build.sh"

    if build_script.exists():
        subprocess.run([str(build_script)], check=True)
    else:
        # Fallback to direct maturin call
        subprocess.run(["maturin", "develop", "--release"], cwd=native_dir, check=True)

    print("  ✓ Native extension built successfully")
    return True


def install_python_deps():
    """Install Python dependencies."""
    print("\nInstalling Python dependencies...")

    # Install in development mode
    subprocess.run(
        [sys.executable, "-m", "pip", "install", "-e", ".[dev]"],
        cwd=Path(__file__).parent,
        check=True,
    )

    print("  ✓ Python dependencies installed")
    return True


def run_tests():
    """Run test suite."""
    print("\nRunning tests...")

    test_dir = Path(__file__).parent / "superinstance" / "tests"

    if not test_dir.exists():
        print(f"  ✗ Test directory not found: {test_dir}")
        return False

    subprocess.run(
        [sys.executable, "-m", "pytest", "-v", str(test_dir)],
        check=True,
    )

    print("  ✓ All tests passed")
    return True


def main():
    """Main setup function."""
    print("=" * 60)
    print("SuperInstance Python Package Setup")
    print("=" * 60)
    print()

    # Check dependencies
    if not check_dependencies():
        sys.exit(1)

    # Build native extension
    if not build_native():
        sys.exit(1)

    # Install Python dependencies
    if not install_python_deps():
        sys.exit(1)

    # Run tests
    print("\n" + "=" * 60)
    print("Setup complete!")
    print("=" * 60)
    print()
    print("To run tests:")
    print("  pytest superinstance/tests/")
    print()
    print("To run examples:")
    print("  python python/examples/semantic_search.py")
    print("  python python/examples/vector_cache.py")
    print("  python python/examples/crdt_sync.py")
    print()


if __name__ == "__main__":
    main()
