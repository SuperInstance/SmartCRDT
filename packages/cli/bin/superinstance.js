#!/usr/bin/env node
/**
 * SuperInstance CLI - Bin Entry Point
 *
 * This file serves as the executable entry point for the superinstance CLI.
 * It simply re-exports the main CLI module.
 */

import { main } from '../dist/superinstance.js';

// Run the CLI
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
