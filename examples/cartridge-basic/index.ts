/**
 * Cartridge Basic Example
 *
 * Demonstrates basic cartridge management operations:
 * - List available cartridges
 * - Search cartridges
 * - Install and load cartridges
 * - Query with loaded cartridges
 * - Unload cartridges
 */

import { CartridgeAPI } from '@lsi/superinstance';
import { ContextPlane } from '@lsi/superinstance';

async function main() {
  console.log('=== Cartridge API Basic Example ===\n');

  // Initialize the Cartridge API
  const api = new CartridgeAPI({
    cartridgeRegistry: './registry',
    cacheDir: './cache',
    autoUpdate: false
  });

  await api.initialize();
  console.log('✓ Cartridge API initialized\n');

  // List available cartridges
  console.log('--- Available Cartridges ---');
  const available = await api.listAvailable();
  console.log(`Found ${available.length} available cartridges`);

  if (available.length > 0) {
    console.log('Cartridges:');
    for (const cartridge of available) {
      console.log(`  - ${cartridge.id} v${cartridge.version}`);
      console.log(`    ${cartridge.description}`);
      console.log(`    Domains: ${cartridge.capabilities.domains.join(', ')}`);
    }
  }
  console.log();

  // Search for cartridges
  console.log('--- Search Cartridges ---');
  const searchResults = await api.search('test');
  console.log(`Found ${searchResults.length} cartridges matching "test"`);
  console.log();

  // Install a cartridge (if available)
  if (available.length > 0) {
    const cartridgeId = available[0].id;

    console.log('--- Install Cartridge ---');
    try {
      await api.install(cartridgeId);
      console.log(`✓ Installed ${cartridgeId}`);
    } catch (error) {
      console.log(`✗ Installation failed: ${error}`);
      console.log('(This is expected if the cartridge is not in the registry)');
    }
    console.log();

    // Check dependencies
    console.log('--- Check Dependencies ---');
    const depCheck = await api.checkDependencies(cartridgeId);
    if (depCheck.satisfied) {
      console.log('✓ All dependencies satisfied');
    } else {
      console.log('Missing dependencies:', depCheck.missing);
      console.log('Conflicts:', depCheck.conflicts);
    }
    console.log();

    // Validate cartridge
    console.log('--- Validate Cartridge ---');
    const validation = await api.validate(cartridgeId);
    if (validation.valid) {
      console.log('✓ Cartridge is valid');
    } else {
      console.log('✗ Validation errors:', validation.errors);
    }
    if (validation.warnings.length > 0) {
      console.log('Warnings:', validation.warnings);
    }
    console.log();

    // Load the cartridge
    console.log('--- Load Cartridge ---');
    try {
      await api.load(cartridgeId);
      console.log(`✓ Loaded ${cartridgeId}`);

      // Check loaded cartridges
      const loaded = await api.listLoaded();
      console.log(`Loaded cartridges: ${loaded.map(c => c.id).join(', ')}`);
    } catch (error) {
      console.log(`✗ Load failed: ${error}`);
    }
    console.log();

    // Get cartridge info
    console.log('--- Cartridge Info ---');
    const info = await api.getInfo(cartridgeId);
    if (info) {
      console.log(`ID: ${info.id}`);
      console.log(`Version: ${info.version}`);
      console.log(`Name: ${info.name}`);
      console.log(`Description: ${info.description}`);
      console.log(`Loaded: ${info.isLoaded}`);
      console.log(`Update available: ${info.isUpdateAvailable}`);
      console.log(`Domains: ${info.capabilities.domains.join(', ')}`);
      console.log(`Privacy level: ${info.capabilities.privacyLevel}`);
    }
    console.log();

    // Example query using ContextPlane with loaded cartridge
    console.log('--- Example Query ---');
    const contextPlane = new ContextPlane({});
    await contextPlane.initialize();

    // Store some knowledge
    await contextPlane.storeKnowledge({
      key: 'test-key',
      value: 'Test knowledge from cartridge'
    });

    // Retrieve knowledge
    const retrieved = await contextPlane.retrieveKnowledge('test-key');
    console.log('Retrieved knowledge:', retrieved);
    console.log();

    // Get statistics
    console.log('--- Cartridge Statistics ---');
    const stats = api.getStats(cartridgeId);
    if (stats) {
      console.log(`Load count: ${stats.loadCount}`);
      console.log(`Total load time: ${stats.totalLoadTime}ms`);
      console.log(`Average load time: ${stats.averageLoadTime}ms`);
      console.log(`Query count: ${stats.queryCount}`);
    }
    console.log();

    // Unload the cartridge
    console.log('--- Unload Cartridge ---');
    await api.unload(cartridgeId);
    console.log(`✓ Unloaded ${cartridgeId}`);
    console.log();

    // Optionally uninstall
    // await api.uninstall(cartridgeId);
    // console.log(`✓ Uninstalled ${cartridgeId}`);
  }

  // List all statistics
  console.log('--- All Statistics ---');
  const allStats = api.getAllStats();
  console.log(`Tracked ${allStats.size} cartridges`);
  console.log();

  console.log('=== Example Complete ===');
}

// Run the example
main().catch(console.error);
