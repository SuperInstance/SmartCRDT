/**
 * Storage Adapter
 *
 * Provides an adapter interface for LevelDB storage.
 */

class StorageAdapter {
  constructor(db) {
    this.db = db;
  }

  /**
   * Store key-value pair
   * @param {string} key - Storage key
   * @param {*} value - Value to store
   * @returns {Promise<void>}
   */
  async store(key, value) {
    await this.db.put(key, JSON.stringify(value));
  }

  /**
   * Retrieve value by key
   * @param {string} key - Storage key
   * @returns {Promise<*>} Retrieved value
   */
  async get(key) {
    try {
      const value = await this.db.get(key);
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  /**
   * Delete key
   * @param {string} key - Storage key
   * @returns {Promise<void>}
   */
  async delete(key) {
    await this.db.del(key);
  }

  /**
   * Get all entries as iterator
   * @returns {AsyncIterator} Entries iterator
   */
  async *entries() {
    for await (const [key, value] of this.db.iterator()) {
      yield [key, JSON.parse(value)];
    }
  }
}

module.exports = StorageAdapter;
