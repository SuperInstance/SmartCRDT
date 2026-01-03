/**
 * Marketplace Client Example
 * Demonstrates usage of the MarketplaceClient for searching, downloading, and publishing cartridges
 */

import { MarketplaceClient } from '@lsi/superinstance';
import type {
  MarketplaceCartridge,
  DownloadProgress,
  CartridgeManifest,
} from '@lsi/superinstance';

/**
 * Example 1: Initialize the marketplace client
 */
function example1_Initialization() {
  console.log('=== Example 1: Client Initialization ===\n');

  // Initialize with default configuration
  const client1 = new MarketplaceClient();

  // Initialize with custom configuration
  const client2 = new MarketplaceClient({
    apiUrl: 'https://marketplace.lsi.dev/api/v1',
    enableCache: true,
    cacheDir: '~/.lsi/marketplace',
    cacheTtl: 3600000, // 1 hour
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
    apiKey: process.env.MARKETPLACE_API_KEY,
  });

  console.log('✓ Client initialized');
}

/**
 * Example 2: Authentication
 */
async function example2_Authentication() {
  console.log('\n=== Example 2: Authentication ===\n');

  const client = new MarketplaceClient({
    apiKey: process.env.MARKETPLACE_API_KEY,
  });

  // Check if authenticated
  if (!client.isAuthenticated()) {
    console.log('Authenticating...');

    // Authenticate with API key
    await client.authenticate(process.env.MARKETPLACE_API_KEY!);

    console.log('✓ Authenticated successfully');
  } else {
    console.log('✓ Already authenticated');
  }

  // Logout when done
  // await client.logout();
}

/**
 * Example 3: Search for cartridges
 */
async function example3_Search() {
  console.log('\n=== Example 3: Search Cartridges ===\n');

  const client = new MarketplaceClient();

  // Basic search
  console.log('Searching for "vector"...');
  const basicResults = await client.search('vector');
  console.log(`Found ${basicResults.length} cartridges`);

  // Advanced search with filters
  console.log('\nSearching with filters...');
  const advancedResults = await client.search('database', {
    category: 'storage',
    minRating: 4.0,
    privacyLevel: ['public'],
    sort: 'rating',
    order: 'desc',
    limit: 10,
  });

  console.log(`Found ${advancedResults.length} highly-rated public cartridges`);

  // Display results
  console.log('\nTop results:');
  for (const cartridge of advancedResults.slice(0, 5)) {
    console.log(`  • ${cartridge.name} v${cartridge.version}`);
    console.log(`    Rating: ${cartridge.rating}/5 (${cartridge.ratingCount} reviews)`);
    console.log(`    Downloads: ${cartridge.downloads}`);
    console.log(`    ${cartridge.description}\n`);
  }
}

/**
 * Example 4: Get cartridge details
 */
async function example4_GetDetails() {
  console.log('\n=== Example 4: Get Cartridge Details ===\n');

  const client = new MarketplaceClient();

  // Get specific cartridge details
  const cartridgeId = 'vector-embeddings-1';
  console.log(`Fetching details for ${cartridgeId}...`);

  const details = await client.getDetails(cartridgeId);

  console.log('\nCartridge Details:');
  console.log(`  Name: ${details.name}`);
  console.log(`  Version: ${details.version}`);
  console.log(`  Author: ${details.author}`);
  console.log(`  Description: ${details.description}`);
  console.log(`  Category: ${details.category}`);
  console.log(`  Tags: ${details.tags.join(', ')}`);
  console.log(`  Privacy Level: ${details.privacyLevel}`);
  console.log(`  Downloads: ${details.downloads}`);
  console.log(`  Rating: ${details.rating}/5 (${details.ratingCount} reviews)`);
  console.log(`  Size: ${(details.sizeBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Homepage: ${details.homepage || 'N/A'}`);
  console.log(`  Repository: ${details.repository || 'N/A'}`);
  console.log(`  Published: ${new Date(details.publishedAt).toLocaleDateString()}`);
  console.log(`  Updated: ${new Date(details.updatedAt).toLocaleDateString()}`);

  console.log('\nCapabilities:');
  console.log(`  Operations: ${details.capabilities.operations.join(', ')}`);
  console.log(`  Data Types: ${details.capabilities.dataTypes.join(', ')}`);
  if (details.capabilities.memoryRequirements) {
    console.log(
      `  Memory: ${details.capabilities.memoryRequirements.min}MB - ${details.capabilities.memoryRequirements.recommended}MB`
    );
  }
}

/**
 * Example 5: Download cartridge with progress tracking
 */
async function example5_Download() {
  console.log('\n=== Example 5: Download Cartridge ===\n');

  const client = new MarketplaceClient();

  const cartridgeId = 'vector-embeddings-1';
  const destination = '~/.lsi/cartridges/vector-embeddings.cartridge';

  console.log(`Downloading ${cartridgeId}...`);

  let lastUpdate = Date.now();

  await client.download(cartridgeId, destination, (progress: DownloadProgress) => {
    const now = Date.now();
    const updateInterval = 500; // Update every 500ms

    if (now - lastUpdate > updateInterval || progress.percentage === 100) {
      const mbDownloaded = (progress.bytesDownloaded / 1024 / 1024).toFixed(2);
      const mbTotal = (progress.totalBytes / 1024 / 1024).toFixed(2);
      const speedMB = (progress.speed / 1024 / 1024).toFixed(2);
      const eta = progress.eta ? `${Math.round(progress.eta)}s` : 'calculating...';

      process.stdout.write(
        `\r[${progress.percentage.toFixed(1)}%] ${mbDownloaded}/${mbTotal} MB @ ${speedMB} MB/s (ETA: ${eta})`
      );

      lastUpdate = now;
    }

    if (progress.percentage === 100) {
      console.log('\n✓ Download complete!');
    }
  });

  // Verify checksum
  console.log('\nVerifying checksum...');
  const details = await client.getDetails(cartridgeId);
  const isValid = await client.verifyChecksum(destination, details.checksum);

  if (isValid) {
    console.log('✓ Checksum verified');
  } else {
    console.log('✗ Checksum verification failed!');
  }
}

/**
 * Example 6: Browse trending and recent cartridges
 */
async function example6_Browse() {
  console.log('\n=== Example 6: Browse Trending & Recent ===\n');

  const client = new MarketplaceClient();

  // Get trending cartridges
  console.log('Fetching trending cartridges...\n');
  const trending = await client.getTrending(10);

  console.log('🔥 Trending Cartridges:');
  for (const cartridge of trending.slice(0, 5)) {
    console.log(`  ${cartridge.downloads.toLocaleString()} ⬇️  ${cartridge.name}`);
    console.log(`    ${cartridge.description}`);
  }

  // Get recently updated
  console.log('\nFetching recently updated...\n');
  const recent = await client.getRecentlyUpdated(10);

  console.log('\n🆕 Recently Updated:');
  for (const cartridge of recent.slice(0, 5)) {
    const updated = new Date(cartridge.updatedAt).toLocaleDateString();
    console.log(`  ${updated} - ${cartridge.name} v${cartridge.version}`);
  }

  // Browse by category
  console.log('\n\nBrowsing by category...\n');
  const categories = ['storage', 'ml', 'privacy', 'performance'];

  for (const category of categories) {
    const cartridges = await client.getByCategory(category);
    console.log(`\n${category.toUpperCase()}: ${cartridges.length} cartridges`);
  }
}

/**
 * Example 7: Rate a cartridge
 */
async function example7_RateCartridge() {
  console.log('\n=== Example 7: Rate Cartridge ===\n');

  const client = new MarketplaceClient({
    apiKey: process.env.MARKETPLACE_API_KEY,
  });

  // Must be authenticated
  if (!client.isAuthenticated()) {
    await client.authenticate(process.env.MARKETPLACE_API_KEY!);
  }

  const cartridgeId = 'vector-embeddings-1';
  const rating = 5;

  console.log(`Rating ${cartridgeId} ${rating}/5...`);

  try {
    await client.rate(cartridgeId, rating);
    console.log('✓ Rating submitted!');
  } catch (error) {
    console.error(`✗ Failed to rate: ${error}`);
  }
}

/**
 * Example 8: Publish a cartridge
 */
async function example8_Publish() {
  console.log('\n=== Example 8: Publish Cartridge ===\n');

  const client = new MarketplaceClient({
    apiKey: process.env.MARKETPLACE_API_KEY,
  });

  // Must be authenticated
  if (!client.isAuthenticated()) {
    await client.authenticate(process.env.MARKETPLACE_API_KEY!);
  }

  // Define cartridge manifest
  const manifest: CartridgeManifest = {
    name: 'my-awesome-cartridge',
    version: '1.0.0',
    description: 'An awesome cartridge for doing amazing things',
    category: 'ml',
    tags: ['machine-learning', 'inference', 'acceleration'],
    privacyLevel: 'public',
    capabilities: {
      operations: ['inference', 'training', 'fine-tuning'],
      dataTypes: ['text', 'image', 'audio'],
      memoryRequirements: {
        min: 512,
        recommended: 1024,
      },
      cpuRequirements: {
        cores: 4,
        frequency: 2.4,
      },
      gpuRequirements: {
        required: false,
        memory: 4096,
      },
    },
    homepage: 'https://github.com/user/my-awesome-cartridge',
    repository: 'https://github.com/user/my-awesome-cartridge',
    license: 'MIT',
  };

  console.log(`Publishing ${manifest.name} v${manifest.version}...`);
  console.log(`Category: ${manifest.category}`);
  console.log(`Privacy: ${manifest.privacyLevel}`);
  console.log(`License: ${manifest.license}`);

  try {
    const result = await client.publish(manifest, [
      './dist/index.js',
      './dist/index.d.ts',
      './README.md',
    ]);

    console.log('\n✓ Published successfully!');
    console.log(`  Cartridge ID: ${result.cartridgeId}`);
    console.log(`  Version: ${result.version}`);
    console.log(`  URL: ${result.url}`);
    console.log(`  Published: ${new Date(result.publishedAt).toLocaleString()}`);
  } catch (error) {
    console.error(`\n✗ Publish failed: ${error}`);
  }
}

/**
 * Example 9: Cache management
 */
async function example9_CacheManagement() {
  console.log('\n=== Example 9: Cache Management ===\n');

  const client = new MarketplaceClient({
    enableCache: true,
    cacheDir: '~/.lsi/marketplace',
  });

  // Get cache statistics
  const stats = client.getCacheStats();

  if (stats) {
    console.log('Cache Statistics:');
    console.log(`  Entries: ${stats.size}`);
    console.log(`  Hits: ${stats.hits}`);
    console.log(`  Misses: ${stats.misses}`);
    console.log(`  Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);
    console.log(`  Total Size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
  }

  // Clean expired entries
  console.log('\nCleaning expired cache entries...');
  await client.cleanCache();
  console.log('✓ Cache cleaned');

  // Clear entire cache
  console.log('\nClearing entire cache...');
  await client.clearCache();
  console.log('✓ Cache cleared');
}

/**
 * Example 10: Advanced search with multiple filters
 */
async function example10_AdvancedSearch() {
  console.log('\n=== Example 10: Advanced Search ===\n');

  const client = new MarketplaceClient();

  // Find high-performance storage cartridges
  console.log('Searching for high-performance storage cartridges...\n');

  const results = await client.search('storage', {
    category: 'storage',
    minRating: 4.5,
    privacyLevel: ['public', 'sensitive'],
    tags: ['performance', 'ssd', 'optimized'],
    sort: 'rating',
    order: 'desc',
    limit: 5,
  });

  console.log(`Found ${results.length} cartridges matching criteria:\n`);

  for (const cartridge of results) {
    console.log(`📦 ${cartridge.name} v${cartridge.version}`);
    console.log(`   ⭐ ${cartridge.rating}/5 (${cartridge.ratingCount} reviews)`);
    console.log(`   ⬇️  ${cartridge.downloads.toLocaleString()} downloads`);
    console.log(`   🔒 ${cartridge.privacyLevel}`);
    console.log(`   📝 ${cartridge.description}`);
    console.log(`   🏷️  ${cartridge.tags.join(', ')}`);
    console.log('');
  }

  // Compare by author
  console.log('\nSearching for cartridges by "lsi-team"...\n');
  const authorResults = await client.getByAuthor('lsi-team');

  console.log(`Found ${authorResults.length} cartridges by lsi-team:\n`);
  for (const cartridge of authorResults) {
    console.log(`  • ${cartridge.name}: ${cartridge.description}`);
  }
}

/**
 * Main function to run all examples
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║          Aequor Marketplace Client Usage Examples              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  try {
    // Run examples
    example1_Initialization();

    await example2_Authentication();

    await example3_Search();

    await example4_GetDetails();

    // Uncomment to run download example (requires network access)
    // await example5_Download();

    await example6_Browse();

    // Uncomment to run rate example (requires authentication)
    // await example7_RateCartridge();

    // Uncomment to run publish example (requires authentication)
    // await example8_Publish();

    await example9_CacheManagement();

    await example10_AdvancedSearch();

    console.log('\n\n✓ All examples completed successfully!\n');
  } catch (error) {
    console.error('\n✗ Example failed:', error);
    process.exit(1);
  }
}

// Run examples if executed directly
if (require.main === module) {
  main().catch(console.error);
}

// Export examples for use in other modules
export {
  example1_Initialization,
  example2_Authentication,
  example3_Search,
  example4_GetDetails,
  example5_Download,
  example6_Browse,
  example7_RateCartridge,
  example8_Publish,
  example9_CacheManagement,
  example10_AdvancedSearch,
};
