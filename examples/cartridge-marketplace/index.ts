/**
 * Cartridge Marketplace Example
 *
 * Demonstrates marketplace integration:
 * - Search for cartridges
 * - Get trending and recent cartridges
 * - Download cartridges with progress tracking
 * - Install and use downloaded cartridges
 */

import { MarketplaceClient, CartridgeAPI } from '@lsi/superinstance';

async function main() {
  console.log('=== Cartridge Marketplace Example ===\n');

  // Initialize marketplace client
  // In production, use: 'https://marketplace.lsi.dev'
  const marketplace = new MarketplaceClient({
    marketplaceUrl: 'http://localhost:3000',  // Mock marketplace
    apiKey: process.env.LSI_API_KEY,  // Optional, for publishing/rating
  });

  console.log('✓ Marketplace client initialized\n');

  // Search for cartridges
  console.log('--- Search Cartridges ---');
  try {
    const results = await marketplace.search('medical', {
      minRating: 4.0,
      privacyLevel: ['public'],
      sortBy: 'rating',
      limit: 10
    });

    console.log(`Found ${results.length} cartridges matching "medical"`);

    for (const cartridge of results) {
      console.log(`\n  ${cartridge.name} v${cartridge.version}`);
      console.log(`  Author: ${cartridge.author}`);
      console.log(`  Rating: ${cartridge.rating}/5 (${cartridge.ratingCount} ratings)`);
      console.log(`  Downloads: ${cartridge.downloads}`);
      console.log(`  Description: ${cartridge.description}`);
      console.log(`  Tags: ${cartridge.tags.join(', ')}`);
    }
  } catch (error) {
    console.log('✗ Search failed (expected if marketplace not running):', error);
  }
  console.log();

  // Get trending cartridges
  console.log('--- Trending Cartridges ---');
  try {
    const trending = await marketplace.getTrending(5);
    console.log(`Top ${trending.length} trending cartridges:`);

    for (const cartridge of trending) {
      console.log(`  ${cartridge.id} - ${cartridge.downloads} downloads`);
    }
  } catch (error) {
    console.log('✗ Failed to get trending (expected if marketplace not running)');
  }
  console.log();

  // Get recently updated
  console.log('--- Recently Updated Cartridges ---');
  try {
    const recent = await marketplace.getRecentlyUpdated(5);
    console.log(`${recent.length} recently updated cartridges:`);

    for (const cartridge of recent) {
      const date = new Date(cartridge.lastUpdated);
      console.log(`  ${cartridge.id} - Updated: ${date.toISOString()}`);
    }
  } catch (error) {
    console.log('✗ Failed to get recent (expected if marketplace not running)');
  }
  console.log();

  // Download a cartridge (with progress tracking)
  console.log('--- Download Cartridge ---');
  const cartridgeId = '@lsi/cartridge-medical';

  try {
    await marketplace.download(
      cartridgeId,
      './cache',
      (progress) => {
        process.stdout.write(`\r  Progress: ${progress.percentage.toFixed(1)}% (${progress.bytesDownloaded}/${progress.totalBytes} bytes)`);
      }
    );
    console.log('\n✓ Download complete');
  } catch (error) {
    console.log('\n✗ Download failed (expected if marketplace not running)');
  }
  console.log();

  // Initialize CartridgeAPI
  console.log('--- Install and Load Cartridge ---');
  const api = new CartridgeAPI({
    cartridgeRegistry: './cache',
    cacheDir: './cache',
    autoUpdate: false
  });

  await api.initialize();

  try {
    // Install the downloaded cartridge
    await api.install(cartridgeId);
    console.log(`✓ Installed ${cartridgeId}`);

    // Load the cartridge
    await api.load(cartridgeId);
    console.log(`✓ Loaded ${cartridgeId}`);

    // Get cartridge info
    const info = await api.getInfo(cartridgeId);
    if (info) {
      console.log('\n  Cartridge Info:');
      console.log(`    Name: ${info.name}`);
      console.log(`    Version: ${info.version}`);
      console.log(`    Domains: ${info.capabilities.domains.join(', ')}`);
      console.log(`    Privacy: ${info.capabilities.privacyLevel}`);
    }

    // Unload
    await api.unload(cartridgeId);
    console.log(`\n✓ Unloaded ${cartridgeId}`);
  } catch (error) {
    console.log('✗ Installation failed (expected if cartridge not downloaded)');
  }
  console.log();

  // Rate a cartridge (requires API key)
  if (process.env.LSI_API_KEY) {
    console.log('--- Rate Cartridge ---');
    try {
      await marketplace.rate(cartridgeId, 5);
      console.log(`✓ Rated ${cartridgeId} 5 stars`);
    } catch (error) {
      console.log('✗ Rating failed:', error);
    }
    console.log();

    // Publish a cartridge (requires API key)
    console.log('--- Publish Cartridge ---');
    try {
      const manifest = {
        id: '@example/test-cartridge',
        version: '1.0.0',
        name: 'Test Cartridge',
        description: 'A test cartridge for demonstration',
        dependencies: [],
        conflicts: [],
        capabilities: {
          domains: ['test'],
          queryTypes: ['question'],
          sizeBytes: 1024,
          loadTimeMs: 100,
          privacyLevel: 'public' as const
        },
        metadata: {},
        checksum: 'abc123'
      };

      const files = ['./index.ts'];

      await marketplace.publish(manifest, files);
      console.log('✓ Published cartridge');
    } catch (error) {
      console.log('✗ Publishing failed:', error);
    }
  } else {
    console.log('--- Publish/Rate (Skipped) ---');
    console.log('Set LSI_API_KEY environment variable to enable publishing and rating');
    console.log();
  }

  console.log('=== Example Complete ===');
}

// Run the example
main().catch(console.error);
