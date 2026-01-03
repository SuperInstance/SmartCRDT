/**
 * Entity Extractor
 *
 * Extracts entities like emails, URLs, dates, and named entities
 * from documents using pattern matching and semantic analysis.
 */

class EntityExtractor {
  constructor(lsiClient) {
    this.lsi = lsiClient;
    this.patterns = this.loadPatterns();
  }

  /**
   * Load entity extraction patterns
   * @returns {Object} Pattern definitions
   */
  loadPatterns() {
    return {
      // Email addresses
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

      // URLs
      url: /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g,

      // Phone numbers (US format)
      phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,

      // Dates
      date: /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/gi,

      // Money amounts
      money: /\$\d+(?:,\d{3})*(?:\.\d{2})?|\d+\s*(?:dollars|USD|EUR|GBP)/gi,

      // Percentages
      percentage: /\d+\.?\d*%/g,

      // Credit card numbers (basic pattern)
      creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g
    };
  }

  /**
   * Extract all entities from document
   * @param {Object} document - Document object
   * @returns {Promise<Object>} Extracted entities
   */
  async extractEntities(document) {
    const entities = {
      patterns: {},
      semantic: [],
      relationships: []
    };

    // Pattern-based extraction
    for (const [type, pattern] of Object.entries(this.patterns)) {
      const matches = document.text.match(pattern);
      if (matches) {
        entities.patterns[type] = [...new Set(matches)]; // Deduplicate
      }
    }

    // Semantic entity extraction
    entities.semantic = await this.extractSemanticEntities(document);

    // Extract relationships
    entities.relationships = await this.extractRelationships(document);

    return entities;
  }

  /**
   * Extract semantic entities using NER-like approach
   * @param {Object} document - Document object
   * @returns {Promise<Array>} Semantic entities
   */
  async extractSemanticEntities(document) {
    const entities = [];
    const sentences = document.text.split(/[.!?]+/);

    for (const sentence of sentences) {
      const words = sentence.split(/\s+/);
      const tags = await this.tagPartsOfSpeech(sentence);

      // Extract noun phrases (potential entities)
      let currentPhrase = [];
      for (let i = 0; i < words.length; i++) {
        if (tags[i] && tags[i].startsWith('NN')) { // Noun
          currentPhrase.push(words[i]);
        } else {
          if (currentPhrase.length > 0) {
            const phrase = currentPhrase.join(' ');
            if (this.isLikelyEntity(phrase)) {
              entities.push({
                text: phrase,
                type: this.guessEntityType(phrase),
                context: sentence.trim(),
                confidence: 0.7
              });
            }
            currentPhrase = [];
          }
        }
      }
    }

    // Deduplicate entities
    const seen = new Set();
    return entities.filter(e => {
      const key = e.text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Simple POS tagging using embeddings
   * @param {string} sentence - Sentence to tag
   * @returns {Promise<Array<string>>} POS tags
   */
  async tagPartsOfSpeech(sentence) {
    // In a real implementation, use proper NLP library
    // For now, return placeholder tags
    const words = sentence.split(/\s+/);
    return words.map(word => {
      if (word[0] === word[0].toUpperCase()) return 'NNP'; // Proper noun
      if (/\d+/.test(word)) return 'CD'; // Cardinal number
      return 'NN'; // Default to noun
    });
  }

  /**
   * Check if phrase is likely an entity
   * @param {string} phrase - Phrase to check
   * @returns {boolean} True if likely entity
   */
  isLikelyEntity(phrase) {
    // Likely an entity if:
    // - Starts with capital letter
    // - Length between 2 and 5 words
    // - Contains alphanumeric characters
    const words = phrase.split(/\s+/);
    if (words.length < 1 || words.length > 5) return false;
    if (!/^[A-Z]/.test(phrase)) return false;
    if (!/[a-zA-Z0-9]/.test(phrase)) return false;

    return true;
  }

  /**
   * Guess entity type based on patterns
   * @param {string} phrase - Entity phrase
   * @returns {string} Entity type
   */
  guessEntityType(phrase) {
    if (/\d{4}/.test(phrase)) return 'DATE';
    if (/\$|dollars|money/i.test(phrase)) return 'MONEY';
    if (/Inc|Corp|LLC|Ltd|Company/i.test(phrase)) return 'ORGANIZATION';
    if (/City|State|Country/i.test(phrase)) return 'LOCATION';
    if (/Dr|Mr|Mrs|Ms|Prof/i.test(phrase)) return 'PERSON';
    return 'UNKNOWN';
  }

  /**
   * Extract relationships between entities
   * @param {Object} document - Document object
   * @returns {Promise<Array>} Entity relationships
   */
  async extractRelationships(document) {
    const relationships = [];
    const sentences = document.text.split(/[.!?]+/);

    for (const sentence of sentences) {
      const entities = await this.extractSemanticEntities({ text: sentence });
      if (entities.length >= 2) {
        // Find relationships between entities in same sentence
        for (let i = 0; i < entities.length; i++) {
          for (let j = i + 1; j < entities.length; j++) {
            const relation = await this.detectRelation(
              entities[i],
              entities[j],
              sentence
            );
            if (relation) {
              relationships.push(relation);
            }
          }
        }
      }
    }

    return relationships;
  }

  /**
   * Detect relationship between two entities
   * @param {Object} entity1 - First entity
   * @param {Object} entity2 - Second entity
   * @param {string} context - Sentence context
   * @returns {Promise<Object|null>} Detected relationship
   */
  async detectRelation(entity1, entity2, context) {
    // Look for relationship indicators
    const relationWords = {
      'EMPLOYER': ['works for', 'employed by', 'at'],
      'CLIENT': ['client of', 'customer of'],
      'PARTNER': ['partnered with', 'in partnership with'],
      'LOCATION': ['located in', 'based in', 'in'],
      'OWNER': ['owns', 'owned by']
    };

    const lowerContext = context.toLowerCase();
    for (const [relation, indicators] of Object.entries(relationWords)) {
      for (const indicator of indicators) {
        if (lowerContext.includes(indicator)) {
          return {
            from: entity1.text,
            to: entity2.text,
            type: relation,
            context: context.trim(),
            confidence: 0.6
          };
        }
      }
    }

    return null;
  }
}

module.exports = EntityExtractor;
