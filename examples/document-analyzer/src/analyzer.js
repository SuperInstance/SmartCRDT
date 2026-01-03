/**
 * Document Analyzer
 *
 * Main analyzer that combines parsing, summarization,
 * entity extraction, and search functionality.
 */

const DocumentParser = require('./parsers');
const TextSummarizer = require('./summarizer');
const EntityExtractor = require('./entities');

class DocumentAnalyzer {
  constructor(lsiClient) {
    this.lsi = lsiClient;
    this.parser = new DocumentParser();
    this.summarizer = new TextSummarizer(lsiClient);
    this.entityExtractor = new EntityExtractor(lsiClient);
  }

  /**
   * Perform full document analysis
   * @param {string} filePath - Path to document
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Complete analysis
   */
  async analyze(filePath, options = {}) {
    // Parse document
    const document = await this.parser.parse(filePath);

    // Run analysis tasks
    const [
      summary,
      entities,
      topics,
      insights
    ] = await Promise.all([
      this.summarizer.summarize(document, options.summary),
      this.entityExtractor.extractEntities(document),
      this.extractTopics(document),
      this.generateInsights(document)
    ]);

    return {
      document: {
        path: filePath,
        format: document.format,
        metadata: document.metadata,
        wordCount: document.wordCount,
        pageCount: document.pageCount
      },
      summary,
      entities,
      topics,
      insights,
      analyzedAt: new Date().toISOString()
    };
  }

  /**
   * Extract topics from document
   * @param {Object} document - Document object
   * @returns {Promise<Array>} Document topics
   */
  async extractTopics(document) {
    const chunks = this.parser.chunkText(document.text, 500);

    // Generate embeddings for chunks
    const embeddings = await Promise.all(
      chunks.map(chunk => this.lsi.embed(chunk))
    );

    // Cluster similar chunks to identify topics
    const clusters = await this.clusterEmbeddings(embeddings);

    // Generate topic labels
    const topics = await Promise.all(
      clusters.map(async cluster => {
        const clusterChunks = cluster.indices.map(i => chunks[i]);
        const combinedText = clusterChunks.join(' ');
        return this.generateTopicLabel(combinedText);
      })
    );

    return topics.map((label, i) => ({
      label,
      relevance: clusters[i].score,
      chunkCount: clusters[i].indices.length
    })).sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Cluster embeddings to find topics
   * @param {Array} embeddings - Vector embeddings
   * @returns {Promise<Array>} Clusters
   */
  async clusterEmbeddings(embeddings) {
    const clusters = [];
    const threshold = 0.7;
    const assigned = new Set();

    for (let i = 0; i < embeddings.length; i++) {
      if (assigned.has(i)) continue;

      const cluster = {
        indices: [i],
        centroid: embeddings[i],
        score: 1.0
      };

      // Find similar embeddings
      for (let j = i + 1; j < embeddings.length; j++) {
        if (assigned.has(j)) continue;

        const similarity = this.lsi.similarity(embeddings[i], embeddings[j]);
        if (similarity > threshold) {
          cluster.indices.push(j);
          assigned.add(j);
        }
      }

      assigned.add(i);
      cluster.score = cluster.indices.length / embeddings.length;
      clusters.push(cluster);
    }

    return clusters;
  }

  /**
   * Generate topic label
   * @param {string} text - Text for topic
   * @returns {Promise<string>} Topic label
   */
  async generateTopicLabel(text) {
    // Extract key phrases
    const keywords = await this.extractKeyPhrases(text);

    // Generate concise label
    const topKeywords = keywords.slice(0, 3).map(k => k.phrase).join(', ');
    return topKeywords || 'General Topic';
  }

  /**
   * Extract key phrases
   * @param {string} text - Text to analyze
   * @returns {Promise<Array>} Key phrases with counts
   */
  async extractKeyPhrases(text) {
    const phrases = [];
    const sentences = text.split(/[.!?]+/);

    for (const sentence of sentences) {
      const words = sentence.split(/\s+/);
      for (let i = 0; i < words.length - 1; i++) {
        const phrase = `${words[i]} ${words[i + 1]}`;
        if (phrase.length > 5 && /^[A-Z]/.test(phrase)) {
          phrases.push({ phrase, sentence });
        }
      }
    }

    // Score phrases by frequency
    const frequency = {};
    phrases.forEach(p => {
      frequency[p.phrase] = (frequency[p.phrase] || 0) + 1;
    });

    return Object.entries(frequency)
      .map(([phrase, count]) => ({ phrase, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Generate insights
   * @param {Object} document - Document object
   * @returns {Promise<Array>} Document insights
   */
  async generateInsights(document) {
    const insights = [];

    // Document length insight
    if (document.wordCount > 10000) {
      insights.push({
        type: 'length',
        level: 'info',
        message: `This is a long document (${document.wordCount} words). Consider using the search feature.`
      });
    }

    // Entity density
    const entities = await this.entityExtractor.extractEntities(document);
    const entityDensity = entities.semantic.length / document.wordCount;
    if (entityDensity > 0.05) {
      insights.push({
        type: 'entity_density',
        level: 'info',
        message: `High entity density detected. Document contains many named entities.`
      });
    }

    // Technical complexity
    const technicalTerms = document.text.match(/\b(?:API|SDK|JSON|XML|HTTP|SQL|NoSQL)\b/gi);
    if (technicalTerms && technicalTerms.length > 10) {
      insights.push({
        type: 'technical',
        level: 'info',
        message: `Document appears to be technical in nature.`
      });
    }

    return insights;
  }

  /**
   * Search within document
   * @param {string} filePath - Path to document
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Search results
   */
  async search(filePath, query, options = {}) {
    const document = await this.parser.parse(filePath);
    const chunks = this.parser.chunkText(document.text, 500);

    // Generate query embedding
    const queryEmbedding = await this.lsi.embed(query);

    // Find similar chunks
    const results = await Promise.all(
      chunks.map(async (chunk, index) => {
        const chunkEmbedding = await this.lsi.embed(chunk);
        const similarity = this.lsi.similarity(queryEmbedding, chunkEmbedding);

        return {
          chunk,
          index,
          similarity,
          preview: chunk.substring(0, 200) + '...'
        };
      })
    );

    // Filter and sort results
    const threshold = options.threshold || 0.5;
    return results
      .filter(r => r.similarity > threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, options.limit || 10);
  }
}

module.exports = DocumentAnalyzer;
