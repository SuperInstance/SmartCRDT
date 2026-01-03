#!/usr/bin/env node

/**
 * Vector Search Example - LSI
 *
 * Simplified semantic search demonstration with simulated vector embeddings.
 */

interface Document {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  embedding: number[];
}

interface SearchResult {
  document: Document;
  score: number;
}

class SimpleVectorSearch {
  private documents: Document[] = [];
  private dimensions = 1536;

  constructor() {
    this.initializeDocuments();
  }

  /**
   * Initialize sample documents
   */
  private initializeDocuments(): void {
    const sampleDocs = [
      {
        id: 'doc-1',
        title: 'User Authentication API',
        content: 'This comprehensive guide covers user authentication mechanisms including JWT tokens, OAuth2 flows, and session management. Learn how to implement secure login systems, password reset functionality, and multi-factor authentication.',
        category: 'Security',
        tags: ['auth', 'security', 'login', 'jwt']
      },
      {
        id: 'doc-2',
        title: 'Database Connection Pooling',
        content: 'Optimize your application performance by implementing efficient database connection pooling. This tutorial covers connection pooling configuration, best practices for handling multiple concurrent connections, and performance monitoring techniques.',
        category: 'Performance',
        tags: ['database', 'connection', 'pooling', 'performance']
      },
      {
        id: 'doc-3',
        title: 'REST API Design Patterns',
        content: 'Master REST API design with comprehensive coverage of HTTP methods, status codes, URL structure, and versioning strategies. Learn about proper request/response formatting, error handling, and API documentation practices.',
        category: 'API',
        tags: ['api', 'rest', 'design', 'http']
      },
      {
        id: 'doc-4',
        title: 'Machine Learning Model Training',
        content: 'Advanced model training techniques including supervised learning, neural networks, and deep learning frameworks. Covers data preprocessing, model selection, hyperparameter tuning, and evaluation metrics.',
        category: 'Research',
        tags: ['ml', 'training', 'neural-networks', 'ai']
      },
      {
        id: 'doc-5',
        title: 'Microservices Architecture',
        content: 'Design and implement scalable microservices systems with proper service discovery, load balancing, and container orchestration using Docker and Kubernetes patterns.',
        category: 'Architecture',
        tags: ['microservices', 'docker', 'kubernetes', 'scaling']
      },
      {
        id: 'doc-6',
        title: 'Caching Strategies',
        content: 'Implement various caching strategies including Redis, Memcached, and in-memory caching. Learn about cache-aside, write-through, and write-behind patterns with real-world examples.',
        category: 'Performance',
        tags: ['cache', 'redis', 'performance', 'optimization']
      },
      {
        id: 'doc-7',
        title: 'Error Handling Patterns',
        content: 'Comprehensive error handling patterns for modern applications including exception handling, logging strategies, and user-friendly error messages with recovery mechanisms.',
        category: 'Best Practices',
        tags: ['error-handling', 'logging', 'exceptions', 'recovery']
      },
      {
        id: 'doc-8',
        title: 'Security Vulnerabilities',
        content: 'Common security vulnerabilities including XSS, CSRF, SQL injection, and how to prevent them. Learn about input validation, output encoding, and security headers.',
        category: 'Security',
        tags: ['security', 'vulnerabilities', 'xss', 'csrf']
      }
    ];

    // Generate mock embeddings for each document
    this.documents = sampleDocs.map(doc => ({
      ...doc,
      embedding: this.generateMockEmbedding(doc.content)
    }));
  }

  /**
   * Generate mock 1536-dimensional vector embedding
   */
  private generateMockEmbedding(text: string): number[] {
    const embedding = new Array(this.dimensions).fill(0);

    // Simple hash-based embedding simulation
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      const index = charCode % this.dimensions;
      embedding[index] += (charCode / 255) - 0.5;
    }

    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }

  /**
   * Generate query embedding
   */
  private generateQueryEmbedding(query: string): number[] {
    return this.generateMockEmbedding(query);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    return magnitudeA > 0 && magnitudeB > 0 ? dotProduct / (magnitudeA * magnitudeB) : 0;
  }

  /**
   * Search for documents similar to query
   */
  search(query: string, topK: number = 5, threshold: number = 0.3): SearchResult[] {
    const queryEmbedding = this.generateQueryEmbedding(query);

    const results = this.documents.map(doc => ({
      document: doc,
      score: this.cosineSimilarity(queryEmbedding, doc.embedding)
    })).filter(result => result.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return results;
  }

  /**
   * Display search results
   */
  displayResults(query: string, results: SearchResult[]): void {
    console.log(`\n🔍 Query: "${query}"`);
    console.log('🎯 Top Results:');

    if (results.length === 0) {
      console.log('   No results found above similarity threshold.');
      return;
    }

    results.forEach((result, index) => {
      const percentage = (result.score * 100).toFixed(1);
      console.log(`${index + 1}. [${result.document.category}] ${result.document.title} (${percentage}% match)`);
      console.log(`   ${result.document.content.substring(0, 80)}...`);
      console.log(`   Tags: ${result.document.tags.join(', ')}\n`);
    });
  }

  /**
   * Get search statistics
   */
  getStats(): { totalDocuments: number; dimensions: number } {
    return {
      totalDocuments: this.documents.length,
      dimensions: this.dimensions
    };
  }
}

class SimpleVectorDemo {
  private searchEngine: SimpleVectorSearch;

  constructor() {
    this.searchEngine = new SimpleVectorSearch();
  }

  async run(): Promise<void> {
    console.log('🔍 LSI Vector Search Demo');
    console.log('==================================================\n');

    // Show stats
    const stats = this.searchEngine.getStats();
    console.log('📁 Document Collection');
    console.log('--------------------');
    console.log(`✓ Indexed ${stats.totalDocuments} documents with ${stats.dimensions}-dim vectors\n`);

    // Sample search queries
    const queries = [
      "How do I authenticate users?",
      "Database connection pooling",
      "Machine learning model training",
      "API design patterns",
      "Security vulnerabilities"
    ];

    console.log('🔍 Search Examples');
    console.log('------------------');

    for (const query of queries) {
      const results = this.searchEngine.search(query, 3, 0.2);
      this.searchEngine.displayResults(query, results);
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay
    }

    console.log('📊 Search Summary');
    console.log('=================');
    console.log(`Total Documents: ${stats.totalDocuments}`);
    console.log(`Average Embedding Dim: ${stats.dimensions}`);
    console.log(`Search Time: <50ms (simulated)`);
    console.log(`Cache Hit Rate: 0% (mock implementation)`);
    console.log(`Index Size: ${(stats.totalDocuments * stats.dimensions * 4 / 1024 / 1024).toFixed(2)}MB`);
  }
}

// Run the demo
async function runDemo() {
  const demo = new SimpleVectorDemo();
  await demo.run();
}

// Support search command line argument
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);

  if (args.includes('--search') && args[2]) {
    // Interactive search mode
    const searchEngine = new SimpleVectorSearch();
    const query = args[2];
    const results = searchEngine.search(query, 5, 0.1);
    searchEngine.displayResults(query, results);
  } else {
    // Run demo
    runDemo().catch(console.error);
  }
}

export { runDemo };
export default runDemo;