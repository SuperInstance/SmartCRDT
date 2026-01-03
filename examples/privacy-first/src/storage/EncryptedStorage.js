/**
 * Encrypted Storage
 *
 * Provides encrypted storage using AES-256 encryption
 * for local data persistence.
 */

const CryptoJS = require('crypto-js');

class EncryptedStorage {
  constructor(config = {}) {
    this.storageType = config.type || 'memory'; // indexeddb, localstorage, memory
    this.encryptionKey = config.encryptionKey;
    this.namespace = config.namespace || 'app';
    this.initialized = false;
  }

  /**
   * Initialize storage
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.storageType === 'indexeddb') {
      await this.initIndexedDB();
    } else if (this.storageType === 'localstorage') {
      this.initLocalStorage();
    }

    if (!this.encryptionKey) {
      this.encryptionKey = await this.generateKey();
    }

    this.initialized = true;
    console.log('✓ Encrypted storage initialized');
  }

  /**
   * Initialize IndexedDB
   * @returns {Promise<void>}
   */
  async initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(`${this.namespace}_db`, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('encrypted')) {
          db.createObjectStore('encrypted', { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Initialize LocalStorage
   */
  initLocalStorage() {
    this.storagePrefix = `${this.namespace}_encrypted_`;
  }

  /**
   * Generate encryption key
   * @returns {Promise<string>} Generated key
   */
  async generateKey() {
    const key = CryptoJS.lib.WordArray.random(256/8);
    return CryptoJS.enc.Hex.stringify(key);
  }

  /**
   * Encrypt data
   * @param {*} data - Data to encrypt
   * @returns {string} Encrypted data
   */
  encrypt(data) {
    const jsonString = JSON.stringify(data);
    const encrypted = CryptoJS.AES.encrypt(
      jsonString,
      this.encryptionKey
    ).toString();
    return encrypted;
  }

  /**
   * Decrypt data
   * @param {string} encryptedData - Encrypted data
   * @returns {*} Decrypted data
   */
  decrypt(encryptedData) {
    try {
      const decrypted = CryptoJS.AES.decrypt(
        encryptedData,
        this.encryptionKey
      );
      const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
      return JSON.parse(jsonString);
    } catch (error) {
      throw new Error('Decryption failed: ' + error.message);
    }
  }

  /**
   * Store encrypted data
   * @param {string} key - Storage key
   * @param {*} value - Value to store
   * @returns {Promise<void>}
   */
  async set(key, value) {
    if (!this.initialized) {
      throw new Error('Storage not initialized');
    }

    const encrypted = this.encrypt(value);

    if (this.storageType === 'indexeddb') {
      await this.setIndexedDB(key, encrypted);
    } else if (this.storageType === 'localstorage') {
      this.setLocalStorage(key, encrypted);
    } else if (this.storageType === 'memory') {
      if (!this.memoryStorage) this.memoryStorage = new Map();
      this.memoryStorage.set(key, encrypted);
    }
  }

  /**
   * Retrieve and decrypt data
   * @param {string} key - Storage key
   * @returns {Promise<*>} Decrypted value
   */
  async get(key) {
    if (!this.initialized) {
      throw new Error('Storage not initialized');
    }

    let encrypted;

    if (this.storageType === 'indexeddb') {
      encrypted = await this.getIndexedDB(key);
    } else if (this.storageType === 'localstorage') {
      encrypted = this.getLocalStorage(key);
    } else if (this.storageType === 'memory') {
      encrypted = this.memoryStorage?.get(key);
    }

    if (!encrypted) return null;

    return this.decrypt(encrypted);
  }

  /**
   * Delete data
   * @param {string} key - Storage key
   * @returns {Promise<void>}
   */
  async delete(key) {
    if (this.storageType === 'indexeddb') {
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction(['encrypted'], 'readwrite');
        const store = transaction.objectStore('encrypted');
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } else if (this.storageType === 'localstorage') {
      localStorage.removeItem(this.storagePrefix + key);
    } else if (this.storageType === 'memory') {
      this.memoryStorage?.delete(key);
    }
  }

  /**
   * IndexedDB operations
   */
  async setIndexedDB(key, value) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['encrypted'], 'readwrite');
      const store = transaction.objectStore('encrypted');
      const request = store.put({ key, value });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getIndexedDB(key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['encrypted'], 'readonly');
      const store = transaction.objectStore('encrypted');
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result?.value);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * LocalStorage operations
   */
  setLocalStorage(key, value) {
    localStorage.setItem(this.storagePrefix + key, value);
  }

  getLocalStorage(key) {
    return localStorage.getItem(this.storagePrefix + key);
  }

  /**
   * Export encrypted data
   * @returns {Promise<Object>} Exported data
   */
  async export() {
    const data = {};

    if (this.storageType === 'memory' && this.memoryStorage) {
      for (const [key, value] of this.memoryStorage) {
        data[key] = value;
      }
    }

    return {
      encrypted: true,
      timestamp: Date.now(),
      data
    };
  }

  /**
   * Clear all data
   * @returns {Promise<void>}
   */
  async clear() {
    if (this.storageType === 'memory') {
      this.memoryStorage?.clear();
    }
  }
}

module.exports = EncryptedStorage;
