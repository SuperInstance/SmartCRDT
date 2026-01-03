#!/usr/bin/env node

/**
 * Build script for Rust native modules
 *
 * This script compiles Rust crates and generates TypeScript bindings.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const NATIVE_DIR = path.join(__dirname);
const FFI_DIR = path.join(NATIVE_DIR, 'ffi');
const INDEX_FILE = path.join(FFI_DIR, 'index.js');

console.log('Building SuperInstance native modules...\n');

// Ensure cargo is available
try {
  execSync('cargo --version', { stdio: 'inherit' });
} catch (error) {
  console.error('Error: cargo not found. Please install Rust from https://rustup.rs/');
  process.exit(1);
}

// Build the workspace
console.log('Building Rust workspace...');
try {
  execSync('cargo build --release', {
    cwd: NATIVE_DIR,
    stdio: 'inherit',
  });
  console.log('✓ Build successful\n');
} catch (error) {
  console.error('Error: Build failed');
  process.exit(1);
}

// Check if index.js was generated
if (fs.existsSync(INDEX_FILE)) {
  console.log('✓ TypeScript bindings generated');
} else {
  console.warn('⚠ Warning: index.js not found. FFI bindings may not have been generated.');
}

console.log('\nBuild complete!');
console.log(`Native modules available in: ${FFI_DIR}`);
