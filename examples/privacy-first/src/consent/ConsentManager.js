/**
 * Consent Manager
 *
 * Manages user consent UI flows and responses.
 */

class ConsentManager {
  constructor(privacyManager) {
    this.privacyManager = privacyManager;
    this.pendingRequests = [];
  }

  /**
   * Show consent dialog
   * @param {string} categoryId - Category ID
   * @param {Array} purposes - Data purposes
   * @returns {Promise<Object>} Consent result
   */
  async showConsentDialog(categoryId, purposes = []) {
    const request = await this.privacyManager.requestConsent(categoryId, purposes);
    this.pendingRequests.push(request);

    return new Promise((resolve, reject) => {
      // In a real app, this would show a UI dialog
      // For demo, auto-accept after delay
      setTimeout(async () => {
        const result = await this.handleConsentResponse({
          requestId: request.id,
          categoryId,
          purposes,
          accepted: true
        });
        resolve(result);
      }, 100);
    });
  }

  /**
   * Handle consent response
   * @param {Object} response - Consent response
   * @returns {Promise<Object>} Consent result
   */
  async handleConsentResponse(response) {
    if (response.accepted) {
      return await this.privacyManager.grantConsent(
        response.requestId,
        response.purposes
      );
    } else {
      return await this.privacyManager.revokeConsent(response.requestId);
    }
  }

  /**
   * Request all required consents
   * @param {Array} categories - Category IDs
   * @returns {Promise<Array>} Consent results
   */
  async requestRequiredConsents(categories) {
    const results = [];

    for (const categoryId of categories) {
      if (!this.privacyManager.hasConsent(categoryId)) {
        const result = await this.showConsentDialog(categoryId);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Show consent management UI
   * @returns {Object} Consent management interface
   */
  showConsentManagementUI() {
    const summary = this.privacyManager.getPrivacySummary();

    return {
      categories: summary.dataCategories,
      consents: summary.consents,
      actions: {
        grant: async (categoryId, purposes) => {
          return await this.showConsentDialog(categoryId, purposes);
        },
        revoke: async (consentId) => {
          return await this.privacyManager.revokeConsent(consentId);
        }
      }
    };
  }
}

module.exports = ConsentManager;
