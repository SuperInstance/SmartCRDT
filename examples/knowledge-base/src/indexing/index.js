/**
 * Vector Index
 *
 * Manages vector embeddings for semantic search and similarity.
 */

class VectorIndex {
  constructor(lsiClient, storage) {
    this.lsi = lsiClient;
    this.storage = storage;
    this.index = new Map(); // docId -> embedding[]
    this.chunkIndex = new Map(); // chunkId -> {docId, chunkIndex, embedding}
  }

  /**
   * Initialize index
   * @returns {Promise<void>}
   */
  async initialize() {
    await this.lsi.initialize();
    console.log('✓ Vector index initialized');
  }

  /**
   * Index document
   * @param {Object} document - Document to index
   * @returns {Promise<Object>} Index result
   */
  async indexDocument(document) {
    const embeddings = [];

    // Generate embeddings for each chunk
    for (let i = 0; i < document.chunks.length; i++) {
      const chunk = document.chunks[i];
      const embedding = await this.lsi.embed(chunk);

      const chunkId = `${document.id}-chunk-${i}`;

      this.chunkIndex.set(chunkId, {
        docId: document.id,
        chunkIndex: i,
        embedding,
        text: chunk
      });

      embeddings.push(embedding);
    }

    // Store document-level embedding (average of chunks)
    const docEmbedding = this.averageEmbeddings(embeddings);
    this.index.set(document.id, docEmbedding);

    return {
      docId: document.id,
      chunksIndexed: document.chunks.length,
      embedding: docEmbedding
    };
  }

  /**
   * Average multiple embeddings
   * @param {Array} embeddings - Embeddings to average
   * @returns {Array} Averaged embedding
   */
  averageEmbeddings(embeddings) {
    if (embeddings.length === 0) return [];

    const dimension = embeddings[0].length;
    const average = new Array(dimension).fill(0);

    for (const embedding of embeddings) {
      for (let i = 0; i < dimension; i++) {
        average[i] += embedding[i];
      }
    }

    return average.map(v => v / embeddings.length);
  }

  /**
   * Search similar documents
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async search(query, options = {}) {
    const {
      limit = 10,
      threshold = 0.5,
      filter = null
    } = options;

    const queryEmbedding = await this.lsi.embed(query);

    // Calculate similarities
    const results = [];

    for (const [docId, docEmbedding] of this.index) {
      if (filter && !filter(docId)) continue;

      const similarity = this.lsi.similarity(queryEmbedding, docEmbedding);

      if (similarity > threshold) {
        const document = await this.storage.get(docId);
        if (document) {
          results.push({
            document,
            similarity
          });
        }
      }
    }

    // Sort by similarity and return top results
    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Search within document chunks
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Chunk results
   */
  async searchChunks(query, options = {}) {
    const {
      limit = 5,
      threshold = 0.5,
      docId = null
    } = options;

    const queryEmbedding = await this.lsi.embed(query);
    const results = [];

    for (const [chunkId, chunkData] of this.chunkIndex) {
      if (docId && chunkData.docId !== docId) continue;

      const similarity = this.lsi.similarity(queryEmbedding, chunkData.embedding);

      if (similarity > threshold) {
        results.push({
          chunkId,
          docId: chunkData.docId,
          chunkIndex: chunkData.chunkIndex,
          text: chunkData.text,
          similarity
        });
      }
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Find similar documents
   * @param {string} docId - Document ID
   * @param {number} limit - Number of results
   * @returns {Promise<Array>} Similar documents
   */
  async findSimilar(docId, limit = 5) {
    const targetEmbedding = this.index.get(docId);
    if (!targetEmbedding) {
      throw new Error(`Document not indexed: ${docId}`);
    }

    const results = [];

    for (const [otherDocId, otherEmbedding] of this.index) {
      if (otherDocId === docId) continue;

      const similarity = this.lsi.similarity(targetEmbedding, otherEmbedding);
      results.push({
        docId: otherDocId,
        similarity
      });
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  /**
   * Get document embedding
   * @param {string} docId - Document ID
   * @returns {Array} Document embedding
   */
  get(docId) {
    return this.index.get(docId);
  }

  /**
   * Remove document from index
   * @param {string} docId - Document ID
   */
  remove(docId) {
    this.index.delete(docId);

    // Remove associated chunks
    for (const [chunkId, chunkData] of this.chunkIndex) {
      if (chunkData.docId === docId) {
        this.chunkIndex.delete(chunkId);
      }
    }
  }

  /**
   * Get index statistics
   * @returns {Object} Index stats
   */
  getStats() {
    return {
      documents: this.index.size,
      chunks: this.chunkIndex.size,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024
    };
  }

  /**
   * Clear entire index
   */
  clear() {
    this.index.clear();
    this.chunkIndex.clear();
  }
}

module.exports = VectorIndex;
