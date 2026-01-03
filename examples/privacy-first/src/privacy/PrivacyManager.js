/**
 * Privacy Manager
 *
 * Manages user privacy including consent tracking,
 * data retention, and the right to be forgotten.
 */

class PrivacyManager {
  constructor(config = {}) {
    this.config = {
      policyVersion: config.policyVersion || '1.0',
      retentionDays: config.retentionDays || 365,
      ...config
    };

    this.consents = new Map();
    this.dataCategories = new Map();
    this.privacyLog = [];
  }

  /**
   * Initialize privacy manager
   * @param {Object} storage - Storage instance
   * @returns {Promise<void>}
   */
  async initialize(storage) {
    this.storage = storage;

    // Load saved consents
    const savedConsents = await this.storage.get('privacy_consents');
    if (savedConsents) {
      this.consents = new Map(Object.entries(savedConsents));
    }

    // Load data categories
    await this.initDataCategories();

    console.log('✓ Privacy manager initialized');
  }

  /**
   * Initialize data categories
   * @returns {Promise<void>}
   */
  async initDataCategories() {
    const defaultCategories = {
      'user_profile': {
        description: 'User profile information',
        sensitive: true,
        retention: this.config.retentionDays,
        purposes: ['account_management', 'personalization']
      },
      'usage_data': {
        description: 'Application usage statistics',
        sensitive: false,
        retention: 90,
        purposes: ['analytics', 'improvement']
      },
      'preferences': {
        description: 'User preferences and settings',
        sensitive: false,
        retention: this.config.retentionDays,
        purposes: ['personalization']
      },
      'communications': {
        description: 'User communications and messages',
        sensitive: true,
        retention: 30,
        purposes: ['messaging']
      }
    };

    for (const [id, category] of Object.entries(defaultCategories)) {
      this.dataCategories.set(id, category);
    }
  }

  /**
   * Request consent for data category
   * @param {string} categoryId - Category ID
   * @param {Array} purposes - Data purposes
   * @returns {Promise<Object>} Consent request
   */
  async requestConsent(categoryId, purposes = []) {
    const category = this.dataCategories.get(categoryId);
    if (!category) {
      throw new Error(`Unknown data category: ${categoryId}`);
    }

    const consentRequest = {
      id: this.generateId(),
      categoryId,
      category: category.description,
      purposes,
      requestedAt: Date.now(),
      status: 'pending'
    };

    this.logEvent('consent_requested', consentRequest);
    return consentRequest;
  }

  /**
   * Grant consent
   * @param {string} requestId - Request ID
   * @param {Array} grantedPurposes - Granted purposes
   * @returns {Promise<Object>} Granted consent
   */
  async grantConsent(requestId, grantedPurposes = []) {
    const consent = {
      id: requestId,
      grantedAt: Date.now(),
      purposes: grantedPurposes,
      status: 'granted'
    };

    this.consents.set(requestId, consent);
    await this.saveConsents();

    this.logEvent('consent_granted', { requestId, purposes: grantedPurposes });
    return consent;
  }

  /**
   * Revoke consent
   * @param {string} requestId - Request ID
   * @returns {Promise<Object>} Revoked consent
   */
  async revokeConsent(requestId) {
    const consent = this.consents.get(requestId);
    if (!consent) {
      throw new Error(`Consent not found: ${requestId}`);
    }

    consent.status = 'revoked';
    consent.revokedAt = Date.now();

    await this.saveConsents();

    this.logEvent('consent_revoked', { requestId });
    return consent;
  }

  /**
   * Check if consent exists
   * @param {string} categoryId - Category ID
   * @param {string} purpose - Optional purpose
   * @returns {boolean} Consent status
   */
  hasConsent(categoryId, purpose = null) {
    for (const consent of this.consents.values()) {
      if (consent.status === 'granted' && consent.categoryId === categoryId) {
        if (!purpose || consent.purposes.includes(purpose)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Save consents to storage
   * @returns {Promise<void>}
   */
  async saveConsents() {
    const consentsObj = Object.fromEntries(this.consents);
    await this.storage.set('privacy_consents', consentsObj);
  }

  /**
   * Record data access
   * @param {string} categoryId - Category ID
   * @param {string} action - Action performed
   * @param {Object} details - Access details
   * @returns {Promise<void>}
   */
  async recordAccess(categoryId, action, details = {}) {
    if (!this.hasConsent(categoryId)) {
      throw new Error(`No consent for category: ${categoryId}`);
    }

    const accessLog = {
      categoryId,
      action,
      details,
      timestamp: Date.now()
    };

    this.logEvent('data_accessed', accessLog);
  }

  /**
   * Implement data retention
   * @returns {Promise<Array>} Expired data
   */
  async enforceRetentionPolicy() {
    const now = Date.now();
    const expiredData = [];

    for (const [categoryId, category] of this.dataCategories) {
      const retentionMs = category.retention * 24 * 60 * 60 * 1000;
      const cutoffTime = now - retentionMs;

      const data = await this.storage.get(`category_${categoryId}`);
      if (data && Array.isArray(data)) {
        for (const item of data) {
          if (item.timestamp < cutoffTime) {
            expiredData.push({ categoryId, itemId: item.id });
          }
        }
      }
    }

    for (const { categoryId, itemId } of expiredData) {
      await this.deleteData(categoryId, itemId);
    }

    this.logEvent('retention_enforced', { deletedCount: expiredData.length });
    return expiredData;
  }

  /**
   * Delete specific data
   * @param {string} categoryId - Category ID
   * @param {string} itemId - Item ID
   * @returns {Promise<void>}
   */
  async deleteData(categoryId, itemId) {
    const data = await this.storage.get(`category_${categoryId}`);
    if (data && Array.isArray(data)) {
      const filtered = data.filter(item => item.id !== itemId);
      await this.storage.set(`category_${categoryId}`, filtered);
    }
  }

  /**
   * Right to be forgotten
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Deleted categories
   */
  async forgetUser(userId) {
    const deletedCategories = [];

    for (const categoryId of this.dataCategories.keys()) {
      if (this.hasConsent(categoryId)) {
        await this.storage.set(`category_${categoryId}`, []);
        deletedCategories.push(categoryId);
      }
    }

    // Revoke all consents
    for (const [id, consent] of this.consents) {
      if (consent.status === 'granted') {
        await this.revokeConsent(id);
      }
    }

    this.logEvent('user_forgotten', { userId, deletedCategories });
    return deletedCategories;
  }

  /**
   * Export user data
   * @returns {Promise<Object>} Exported data
   */
  async exportUserData() {
    const exportData = {
      exportedAt: Date.now(),
      categories: {}
    };

    for (const [categoryId, category] of this.dataCategories) {
      if (this.hasConsent(categoryId)) {
        const data = await this.storage.get(`category_${categoryId}`);
        exportData.categories[categoryId] = {
          description: category.description,
          data: data || []
        };
      }
    }

    this.logEvent('data_exported', { categories: Object.keys(exportData.categories) });
    return exportData;
  }

  /**
   * Get privacy summary
   * @returns {Object} Privacy summary
   */
  getPrivacySummary() {
    return {
      dataCategories: Array.from(this.dataCategories.entries()).map(([id, cat]) => ({
        id,
        description: cat.description,
        sensitive: cat.sensitive,
        hasConsent: this.hasConsent(id),
        purposes: cat.purposes
      })),
      consents: Array.from(this.consents.values()).map(c => ({
        id: c.id,
        status: c.status,
        grantedAt: c.grantedAt,
        purposes: c.purposes
      })),
      logCount: this.privacyLog.length
    };
  }

  /**
   * Log privacy event
   * @param {string} type - Event type
   * @param {Object} data - Event data
   */
  logEvent(type, data) {
    this.privacyLog.push({
      type,
      data,
      timestamp: Date.now()
    });

    if (this.privacyLog.length > 1000) {
      this.privacyLog = this.privacyLog.slice(-1000);
    }
  }

  /**
   * Get privacy log
   * @param {number} limit - Log entry limit
   * @returns {Array} Privacy log entries
   */
  getPrivacyLog(limit = 100) {
    return this.privacyLog.slice(-limit);
  }

  /**
   * Generate unique ID
   * @returns {string} Unique ID
   */
  generateId() {
    return `privacy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = PrivacyManager;
