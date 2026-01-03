/**
 * Network Manager
 *
 * Monitors network status and provides offline-capable fetch.
 */

class NetworkManager {
  constructor() {
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this.listeners = new Set();
  }

  /**
   * Initialize
   */
  initialize() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notifyListeners('online');
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notifyListeners('offline');
      });
    }

    console.log('✓ Network manager initialized');
  }

  /**
   * Subscribe to network changes
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.listeners.add(callback);

    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners
   * @param {string} status - Network status
   */
  notifyListeners(status) {
    for (const listener of this.listeners) {
      listener(status);
    }
  }

  /**
   * Check if online
   * @returns {boolean} Online status
   */
  online() {
    return this.isOnline;
  }

  /**
   * Execute request with fallback
   * @param {string} url - Request URL
   * @param {Object} options - Request options
   * @returns {Promise<Response>} Response
   */
  async fetch(url, options = {}) {
    if (!this.isOnline) {
      if (options.useCache !== false) {
        return this.getCached(url);
      }
      throw new Error('Offline: no cached data available');
    }

    try {
      const response = await this.fetchWithRetry(url, options);

      if (response.ok && options.method === 'GET') {
        this.cacheResponse(url, response.clone());
      }

      return response;
    } catch (error) {
      if (options.fallback) {
        return options.fallback(error);
      }
      throw error;
    }
  }

  /**
   * Fetch with retry
   * @param {string} url - Request URL
   * @param {Object} options - Request options
   * @param {number} retries - Retry count
   * @returns {Promise<Response>} Response
   */
  async fetchWithRetry(url, options, retries = 3) {
    try {
      return await fetch(url, options);
    } catch (error) {
      if (retries > 0) {
        await this.delay(1000);
        return this.fetchWithRetry(url, options, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Cache response
   * @param {string} url - URL
   * @param {Response} response - Response to cache
   * @returns {Promise<void>}
   */
  async cacheResponse(url, response) {
    // Simplified caching - in production use actual cache API
    this.cache = this.cache || new Map();
    this.cache.set(url, {
      data: await response.text(),
      timestamp: Date.now()
    });
  }

  /**
   * Get cached response
   * @param {string} url - URL
   * @returns {Response} Cached response
   */
  async getCached(url) {
    this.cache = this.cache || new Map();
    const cached = this.cache.get(url);

    if (cached) {
      return {
        ok: true,
        text: async () => cached.data
      };
    }

    throw new Error('No cached data available');
  }

  /**
   * Delay helper
   * @param {number} ms - Milliseconds
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = NetworkManager;
