/**
 * Privacy-First Application
 *
 * Main application demonstrating privacy-first development.
 */

const { LSIClient } = require('@lsi/sdk');
const EncryptedStorage = require('./storage/EncryptedStorage');
const PrivacyManager = require('./privacy/PrivacyManager');
const ConsentManager = require('./consent/ConsentManager');

class PrivacyFirstApp {
  constructor(config = {}) {
    this.config = {
      storageType: config.storageType || 'memory',
      modelPath: config.modelPath || './models',
      ...config
    };

    this.lsi = new LSIClient({
      modelPath: this.config.modelPath,
      disableTelemetry: true,
      localOnly: true
    });

    this.storage = new EncryptedStorage({
      type: this.config.storageType
    });

    this.privacy = new PrivacyManager({
      retentionDays: config.retentionDays || 365
    });

    this.consent = new ConsentManager(this.privacy);
  }

  /**
   * Initialize application
   * @returns {Promise<void>}
   */
  async initialize() {
    await this.lsi.initialize();
    await this.storage.initialize();
    await this.privacy.initialize(this.storage);

    console.log('✓ Privacy-first application initialized');
    await this.showPrivacyNotice();
  }

  /**
   * Show initial privacy notice
   * @returns {Promise<void>}
   */
  async showPrivacyNotice() {
    const notice = {
      title: 'Privacy Notice',
      points: [
        'All data is stored locally on your device',
        'No data is sent to external servers',
        'You have full control over your data',
        'You can export or delete your data at any time',
        'Data is encrypted for additional security'
      ]
    };

    // Request consents for core categories
    await this.consent.requestRequiredConsents([
      'user_profile',
      'preferences'
    ]);
  }

  /**
   * Store user data (with consent check)
   * @param {string} categoryId - Data category
   * @param {Object} data - Data to store
   * @returns {Promise<Object>} Stored entry
   */
  async storeData(categoryId, data) {
    if (!this.privacy.hasConsent(categoryId)) {
      throw new Error(`No consent for category: ${categoryId}`);
    }

    await this.privacy.recordAccess(categoryId, 'store', { dataSize: JSON.stringify(data).length });

    const existingData = await this.storage.get(`category_${categoryId}`) || [];

    const entry = {
      id: this.generateId(),
      timestamp: Date.now(),
      data
    };

    existingData.push(entry);
    await this.storage.set(`category_${categoryId}`, existingData);

    return entry;
  }

  /**
   * Retrieve user data (with consent check)
   * @param {string} categoryId - Data category
   * @param {Object} query - Query filters
   * @returns {Promise<Array>} Retrieved data
   */
  async getData(categoryId, query = {}) {
    if (!this.privacy.hasConsent(categoryId)) {
      throw new Error(`No consent for category: ${categoryId}`);
    }

    await this.privacy.recordAccess(categoryId, 'retrieve');

    const data = await this.storage.get(`category_${categoryId}`) || [];

    let filtered = data;
    if (query.startDate) {
      filtered = filtered.filter(d => d.timestamp >= query.startDate);
    }
    if (query.endDate) {
      filtered = filtered.filter(d => d.timestamp <= query.endDate);
    }

    return filtered;
  }

  /**
   * Delete user data
   * @param {string} categoryId - Data category
   * @param {string} entryId - Entry ID
   * @returns {Promise<void>}
   */
  async deleteData(categoryId, entryId) {
    if (!this.privacy.hasConsent(categoryId)) {
      throw new Error(`No consent for category: ${categoryId}`);
    }

    await this.privacy.recordAccess(categoryId, 'delete', { entryId });
    await this.privacy.deleteData(categoryId, entryId);
  }

  /**
   * Export all user data
   * @returns {Promise<Object>} Exported data
   */
  async exportUserData() {
    return await this.privacy.exportUserData();
  }

  /**
   * Delete all user data
   * @returns {Promise<Array>} Deleted categories
   */
  async deleteAllData() {
    return await this.privacy.forgetUser('current');
  }

  /**
   * Get privacy dashboard
   * @returns {Object} Privacy dashboard
   */
  getPrivacyDashboard() {
    return {
      summary: this.privacy.getPrivacySummary(),
      recentActivity: this.privacy.getPrivacyLog(20),
      actions: {
        exportData: () => this.exportUserData(),
        deleteAll: () => this.deleteAllData(),
        manageConsents: () => this.consent.showConsentManagementUI()
      }
    };
  }

  /**
   * Generate unique ID
   * @returns {string} Unique ID
   */
  generateId() {
    return `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = PrivacyFirstApp;
