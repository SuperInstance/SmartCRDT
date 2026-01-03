#!/usr/bin/env node

/**
 * Vector Search Demo
 *
 * Demonstrates semantic search using vector embeddings.
 * Converts documents and queries to high-dimensional vectors
 * and finds semantically similar content.
 */

import { openai } from '@ai-sdk/openai';
import { createOpenAI } from '@ai-sdk/openai';
import { embed, embeddings } from '@ai-sdk/embeddings';
import { TextSearchIndex } from 'vectordb';
import { VectorStore } from '@ai-sdk/vector';

// Configuration
const CONFIG = {
  embeddingModel: 'text-embedding-ada-002',
  dimensions: 1536,
  topK: 5,
  similarityThreshold: 0.7,
  enableCache: true,
  cacheSize: 1000
};

// Sample documents for demonstration
const SAMPLE_DOCUMENTS = [
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
    content: 'Dive deep into machine learning model training with advanced techniques including data preprocessing, feature engineering, model selection, and hyperparameter optimization. Learn about cross-validation, ensemble methods, and model evaluation metrics.',
    category: 'Research',
    tags: ['ml', 'training', 'models', 'ai']
  },
  {
    id: 'doc-5',
    title: 'Docker Containerization',
    content: 'Learn containerization fundamentals with Docker. This guide covers image creation, container management, networking, Docker Compose for multi-container applications, and production deployment strategies.',
    category: 'DevOps',
    tags: ['docker', 'container', 'deployment', 'devops']
  }
];

class VectorSearchEngine {
  private documents: typeof SAMPLE_DOCUMENTS;
  private vectorStore: any;
  private cache: Map<string, any[]>;
  private stats: {
    totalSearches: number;
    cacheHits: number;
    totalDocuments: number;
    totalTime: number;
  };

  constructor() {
    this.documents = [];
    this.cache = new Map();
    this.stats = {
      totalSearches: 0,
      cacheHits: 0,
      totalDocuments: 0,
      totalTime: 0
    };
  }

  async initialize() {
    console.log('🚀 Initializing Vector Search Engine...');

    // Initialize vector store (using in-memory for demo)
    this.vectorStore = new VectorStore({
      dimensions: CONFIG.dimensions,
      metric: 'cosine'
    });

    // Index sample documents
    await this.indexDocuments(SAMPLE_DOCUMENTS);

    console.log(`✅ Initialized with ${this.documents.length} documents`);
  }

  async indexDocuments(docs: typeof SAMPLE_DOCUMENTS) {
    console.log('📁 Indexing documents...');

    for (const doc of docs) {
      // Generate embedding for document
      const embedding = await this.generateEmbedding(doc.content);

      // Store in vector database
      await this.vectorStore.add({
        id: doc.id,
        vector: embedding,
        metadata: {
          title: doc.title,
          category: doc.category,
          tags: doc.tags,
          snippet: doc.content.substring(0, 200) + '...'
        }
      });

      this.documents.push(doc);
      this.stats.totalDocuments++;
    }

    console.log('✅ Documents indexed successfully');
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      // For demo purposes, simulate embedding generation
      // In production, use actual embedding service
      const words = text.toLowerCase().split(/\s+/);
      const embedding = new Array(CONFIG.dimensions).fill(0);

      // Simple hash-based simulation
      words.forEach((word, i) => {
        const hash = this.simpleHash(word);
        for (let j = 0; j < 10; j++) {
          embedding[(hash + i * 10 + j) % CONFIG.dimensions] += 1;
        }
      });

      // Normalize
      const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      return embedding.map(val => val / magnitude);
    } catch (error) {
      console.error('Error generating embedding:', error);
      return new Array(CONFIG.dimensions).fill(0);
    }
  }

  simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  async search(query: string, options: { topK?: number; threshold?: number } = {}) {
    const startTime = Date.now();
    this.stats.totalSearches++;

    const cacheKey = `${query}-${options.topK || CONFIG.topK}-${options.threshold || CONFIG.similarityThreshold}`;

    // Check cache
    if (CONFIG.enableCache && this.cache.has(cacheKey)) {
      this.stats.cacheHits++;
      console.log('🎯 Cache hit!');
      return this.cache.get(cacheKey)!;
    }

    console.log(`🔍 Searching for: "${query}"`);

    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);

    // Perform similarity search
    const results = await this.vectorStore.search({
      vector: queryEmbedding,
      k: options.topK || CONFIG.topK,
      threshold: options.threshold || CONFIG.similarityThreshold
    });

    // Format results
    const formattedResults = results.map((result: any, index: number) => ({
      rank: index + 1,
      document: this.documents.find(d => d.id === result.id)!,
      score: result.score,
      snippet: result.metadata.snippet
    }));

    // Update stats
    const searchTime = Date.now() - startTime;
    this.stats.totalTime += searchTime;

    // Cache result
    if (CONFIG.enableCache) {
      this.cache.set(cacheKey, formattedResults);

      // Simple cache eviction
      if (this.cache.size > CONFIG.cacheSize) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
    }

    console.log(`🎯 Found ${formattedResults.length} results in ${searchTime}ms`);
    return formattedResults;
  }

  getStats() {
    const avgSearchTime = this.stats.totalSearches > 0
      ? this.stats.totalTime / this.stats.totalSearches
      : 0;

    const cacheHitRate = this.stats.totalSearches > 0
      ? (this.stats.cacheHits / this.stats.totalSearches) * 100
      : 0;

    return {
      totalDocuments: this.stats.totalDocuments,
      totalSearches: this.stats.totalSearches,
      cacheHits: this.stats.cacheHits,
      cacheHitRate: cacheHitRate.toFixed(1) + '%',
      avgSearchTime: avgSearchTime.toFixed(0) + 'ms',
      cacheSize: this.cache.size
    };
  }

  clearCache() {
    this.cache.clear();
    console.log('🗑️ Cache cleared');
  }
}

// Demo runner
async function runDemo() {
  console.log('🔍 LSI Vector Search Demo');
  console.log('==================================================\n');

  const engine = new VectorSearchEngine();
  await engine.initialize();

  // Demo search queries
  const demoQueries = [
    'How do I authenticate users?',
    'Database connection pooling',
    'Machine learning model training',
    'API design patterns',
    'Docker containerization'
  ];

  console.log('📁 Indexing Documents');
  console.log('--------------------');
  console.log(`✓ Technical Documentation (5 docs)`);
  console.log(`✓ Sample content for demonstration`);
  console.log(`✅ Indexed ${SAMPLE_DOCUMENTS.length} documents with ${CONFIG.dimensions}-dim vectors\n`);

  console.log('🔍 Search Examples');
  console.log('------------------\n');

  for (const query of demoQueries) {
    console.log(`Query: "${query}"`);
    console.log('🎯 Top Results:');

    const results = await engine.search(query);

    results.forEach((result: any) => {
      console.log(`${result.rank}. [${result.document.category}] ${result.document.title} (${(result.score * 100).toFixed(1)}% match)`);
      console.log(`   - ${result.snippet}\n`);
    });
  }

  console.log('📊 Search Statistics');
  console.log('===================');
  const stats = engine.getStats();
  Object.entries(stats).forEach(([key, value]) => {
    console.log(`${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: ${value}`);
  });

  console.log('\n🎉 Demo Complete!');
  console.log('Try interactive search with: npm run search');
}

// Interactive search
async function interactiveSearch() {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const engine = new VectorSearchEngine();
  await engine.initialize();

  console.log('\n🔍 Interactive Vector Search');
  console.log('Type "exit" to quit\n');

  const askQuestion = (query: string): Promise<string> => {
    return new Promise(resolve => {
      readline.question(query, resolve);
    });
  };

  while (true) {
    const input = await askQuestion('Search> ');

    if (input.toLowerCase() === 'exit') {
      break;
    }

    if (input.trim()) {
      const results = await engine.search(input);
      console.log('\nResults:');
      results.forEach((result: any) => {
        console.log(`${result.rank}. [${result.document.category}] ${result.document.title}`);
        console.log(`   Score: ${(result.score * 100).toFixed(1)}%`);
        console.log(`   Tags: ${result.document.tags.join(', ')}\n`);
      });
    }
  }

  readline.close();
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--search') || args.includes('-s')) {
    interactiveSearch().catch(console.error);
  } else {
    runDemo().catch(console.error);
  }
}

export { VectorSearchEngine };
export default runDemo;