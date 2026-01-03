/**
 * Search Engine
 *
 * Combines semantic search with knowledge graph traversal
 * for intelligent document retrieval.
 */

class SearchEngine {
  constructor(vectorIndex, knowledgeGraph) {
    this.vectorIndex = vectorIndex;
    this.graph = knowledgeGraph;
  }

  /**
   * Semantic search
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async semanticSearch(query, options = {}) {
    return await this.vectorIndex.search(query, options);
  }

  /**
   * Hybrid search (semantic + graph)
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Combined results
   */
  async hybridSearch(query, options = {}) {
    const semanticResults = await this.semanticSearch(query, options);
    const expandedResults = [];

    // Expand results using knowledge graph
    for (const result of semanticResults) {
      const related = this.graph.findRelated(`document:${result.document.id}`, 1);
      const relatedDocs = related
        .filter(node => node.id.startsWith('document:'))
        .map(node => node.id.replace('document:', ''));

      for (const relatedDocId of relatedDocs) {
        if (relatedDocId !== result.document.id) {
          const relatedDoc = await this.vectorIndex.storage.get(relatedDocId);
          if (relatedDoc && !expandedResults.find(r => r.document.id === relatedDocId)) {
            expandedResults.push({
              document: relatedDoc,
              similarity: result.similarity * 0.5, // Lower similarity for related docs
              relationship: 'graph'
            });
          }
        }
      }
    }

    // Combine and re-rank
    const combined = [...semanticResults, ...expandedResults];
    return combined
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, options.limit || 10);
  }

  /**
   * Faceted search
   * @param {string} query - Search query
   * @param {Object} facets - Facet filters
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Filtered results
   */
  async facetedSearch(query, facets, options = {}) {
    const results = await this.semanticSearch(query, options);

    return results.filter(result => {
      for (const [key, value] of Object.entries(facets)) {
        const docValue = result.document.metadata[key];
        if (Array.isArray(value)) {
          if (!value.includes(docValue)) return false;
        } else {
          if (docValue !== value) return false;
        }
      }
      return true;
    });
  }

  /**
   * Suggest related content
   * @param {string} docId - Document ID
   * @param {number} limit - Number of suggestions
   * @returns {Promise<Array>} Related document IDs
   */
  async suggestRelated(docId, limit = 5) {
    // Vector similarity
    const similar = await this.vectorIndex.findSimilar(docId, limit);

    // Graph traversal
    const related = this.graph.findRelated(`document:${docId}`, 2)
      .filter(node => node.id.startsWith('document:'))
      .map(node => node.id.replace('document:', ''));

    // Combine results
    const suggestions = new Set([
      ...similar.map(s => s.docId),
      ...related
    ]);

    return Array.from(suggestions).slice(0, limit);
  }

  /**
   * Autocomplete suggestions
   * @param {string} prefix - Search prefix
   * @param {number} limit - Number of suggestions
   * @returns {Promise<Array>} Autocomplete suggestions
   */
  async autocomplete(prefix, limit = 5) {
    const suggestions = [];

    // Search through document titles
    for (const [docId, doc] of this.vectorIndex.storage.entries()) {
      if (doc.path.toLowerCase().startsWith(prefix.toLowerCase())) {
        suggestions.push({
          type: 'document',
          text: doc.path,
          id: docId
        });
      }
    }

    // Search through entity names
    for (const [nodeId, node] of this.graph.nodes) {
      if (node.id.startsWith('entity:') && node.data.text) {
        if (node.data.text.toLowerCase().startsWith(prefix.toLowerCase())) {
          suggestions.push({
            type: 'entity',
            text: node.data.text,
            id: nodeId
          });
        }
      }
    }

    return suggestions.slice(0, limit);
  }
}

module.exports = SearchEngine;
