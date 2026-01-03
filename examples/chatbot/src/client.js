/**
 * LSI Client Initialization
 *
 * This module initializes the LSI client with local-only settings
 * for privacy-first operation.
 */

const { LSIClient } = require('@lsi/sdk');

// Initialize LSI with default settings
const client = new LSIClient({
  modelPath: './models',  // Local models directory
  cacheSize: 1000,        // Vector cache size
  persistence: true,      // Enable conversation persistence
  storagePath: './data'   // Local storage path
});

/**
 * Initialize the LSI client
 * @returns {Promise<boolean>} True if successful
 */
async function initialize() {
  try {
    await client.initialize();
    console.log('✓ LSI client initialized');
    return true;
  } catch (error) {
    console.error('✗ Initialization failed:', error.message);
    return false;
  }
}

module.exports = { client, initialize };
