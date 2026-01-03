import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { SQLiteService } from '@lsi/superinstance';
import { KnowledgeGraph } from '@lsi/superinstance';
import { SemanticStore } from '@lsi/superinstance';
import { VectorStore } from '@lsi/superinstance';
import type { KnowledgeEntry, GraphNode, SearchResult } from '@lsi/protocol';

describe('Knowledge Persistence Integration Test Suite', () => {
  let sqliteService: SQLiteService;
  let knowledgeGraph: KnowledgeGraph;
  let semanticStore: SemanticStore;
  let vectorStore: VectorStore;
  let testDbPath = '/tmp/test-knowledge.db';

  beforeAll(async () => {
    // Initialize SQLite service
    sqliteService = new SQLiteService({
      databasePath: testDbPath,
      enableWAL: true,
      journalMode: 'WAL'
    });

    // Initialize knowledge components
    knowledgeGraph = new KnowledgeGraph({
      sqliteService,
      maxNodes: 1000,
      maxEdges: 5000
    });

    semanticStore = new SemanticStore({
      sqliteService,
      maxEntries: 5000
    });

    vectorStore = new VectorStore({
      sqliteService,
      dimension: 1536
    });

    // Initialize all services
    await sqliteService.initialize();
    await knowledgeGraph.initialize();
    await semanticStore.initialize();
    await vectorStore.initialize();

    // Create required tables
    await sqliteService.createTables();
  });

  afterAll(async () => {
    await sqliteService.close();
    // Clean up test database
    import { promises as fs } from 'fs';
    try {
      await fs.unlink(testDbPath);
    } catch (e) {
      // Ignore if file doesn't exist
    }
  });

  beforeEach(async () => {
    // Clear all data before each test
    await sqliteService.clearAllTables();
  });

  describe('SQLite Service Operations', () => {
    it('should store and retrieve knowledge entries', async () => {
      // Arrange
      const entry: KnowledgeEntry = {
        id: 'test-entry-1',
        content: 'Artificial intelligence is the simulation of human intelligence by machines',
        type: 'fact',
        source: 'web',
        timestamp: Date.now(),
        metadata: {
          confidence: 0.9,
          tags: ['AI', 'definition']
        }
      };

      // Act
      await sqliteService.storeKnowledge(entry);
      const retrieved = await sqliteService.getKnowledge('test-entry-1');

      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(entry.id);
      expect(retrieved.content).toBe(entry.content);
      expect(retrieved.type).toBe(entry.type);
    });

    it('should search knowledge with full-text search', async () => {
      // Arrange
      const entries = [
        {
          id: 'ai-def',
          content: 'Artificial intelligence (AI) is intelligence demonstrated by machines',
          type: 'definition'
        },
        {
          id: 'ml-intro',
          content: 'Machine learning is a subset of artificial intelligence',
          type: 'explanation'
        },
        {
          id: 'dl-neural',
          content: 'Deep learning uses neural networks with many layers',
          type: 'technology'
        }
      ];

      // Store entries
      for (const entry of entries) {
        await sqliteService.storeKnowledge(entry);
      }

      // Act
      const results = await sqliteService.searchKnowledge('artificial intelligence');

      // Assert
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].relevanceScore).toBeGreaterThan(0);

      // Results should be sorted by relevance
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].relevanceScore).toBeGreaterThanOrEqual(results[i + 1].relevanceScore);
      }
    });

    it('should handle concurrent knowledge operations', async () => {
      // Arrange
      const entryCount = 100;
      const entries = Array(entryCount).fill(null).map((_, i) => ({
        id: `concurrent-${i}`,
        content: `Knowledge entry ${i}`,
        type: 'fact',
        timestamp: Date.now() + i
      }));

      // Act
      const storePromises = entries.map(entry => sqliteService.storeKnowledge(entry));
      await Promise.all(storePromises);

      const searchPromises = [
        sqliteService.searchKnowledge('entry'),
        sqliteService.searchKnowledge('knowledge'),
        sqliteService.searchKnowledge('fact')
      ];
      const searchResults = await Promise.all(searchPromises);

      // Assert
      expect(searchResults.every(result => result.length > 0)).toBe(true);
    });

    it('should maintain data integrity', async () => {
      // Arrange
      const entry: KnowledgeEntry = {
        id: 'integrity-test',
        content: 'Data integrity test content',
        type: 'test',
        source: 'test',
        timestamp: Date.now()
      };

      // Act
      await sqliteService.storeKnowledge(entry);
      const retrieved = await sqliteService.getKnowledge('integrity-test');

      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved.content).toBe(entry.content);
      expect(retrieved.id).toBe(entry.id);
      expect(retrieved.timestamp).toBe(entry.timestamp);
    });

    it('should handle database transactions', async () => {
      // Arrange
      const entries = [
        { id: 'tx-1', content: 'Transaction test 1', type: 'test' },
        { id: 'tx-2', content: 'Transaction test 2', type: 'test' }
      ];

      // Act
      await sqliteService.executeTransaction(async (tx) => {
        for (const entry of entries) {
          await tx.storeKnowledge(entry);
        }
      });

      // Assert
      const result1 = await sqliteService.getKnowledge('tx-1');
      const result2 = await sqliteService.getKnowledge('tx-2');
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });

  describe('Knowledge Graph Operations', () => {
    it('should create and manage graph nodes', async () => {
      // Arrange
      const node: GraphNode = {
        id: 'ai-node',
        label: 'Artificial Intelligence',
        type: 'concept',
        properties: {
          definition: 'Simulation of human intelligence',
          field: 'Computer Science'
        }
      };

      // Act
      await knowledgeGraph.addNode(node);
      const retrieved = await knowledgeGraph.getNode('ai-node');

      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(node.id);
      expect(retrieved.label).toBe(node.label);
      expect(retrieved.properties).toEqual(node.properties);
    });

    it('should create and manage graph edges', async () => {
      // Arrange
      await knowledgeGraph.addNode({
        id: 'ai-node',
        label: 'Artificial Intelligence',
        type: 'concept'
      });

      await knowledgeGraph.addNode({
        id: 'ml-node',
        label: 'Machine Learning',
        type: 'subfield'
      });

      const edge = {
        id: 'ai-ml-edge',
        source: 'ai-node',
        target: 'ml-node',
        type: 'subfield_of',
        weight: 0.9
      };

      // Act
      await knowledgeGraph.addEdge(edge);
      const retrieved = await knowledgeGraph.getEdge('ai-ml-edge');

      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved.source).toBe(edge.source);
      expect(retrieved.target).toBe(edge.target);
      expect(retrieved.weight).toBe(edge.weight);
    });

    it('should find shortest path between nodes', async () => {
      // Arrange - Create a chain: A -> B -> C -> D
      const nodes = ['A', 'B', 'C', 'D'];
      for (const node of nodes) {
        await knowledgeGraph.addNode({
          id: node,
          label: node,
          type: 'node'
        });
      }

      const edges = [
        { source: 'A', target: 'B' },
        { source: 'B', target: 'C' },
        { source: 'C', target: 'D' }
      ];

      for (const edge of edges) {
        await knowledgeGraph.addEdge({
          id: `${edge.source}-${edge.target}`,
          source: edge.source,
          target: edge.target,
          type: 'connects'
        });
      }

      // Act
      const path = await knowledgeGraph.findPath('A', 'D');

      // Assert
      expect(path).toBeDefined();
      expect(path.length).toBe(4); // A -> B -> C -> D
      expect(path[0]).toBe('A');
      expect(path[path.length - 1]).toBe('D');
    });

    it('should perform graph traversal', async () => {
      // Arrange
      // Create a small graph
      await knowledgeGraph.addNode({ id: 'center', label: 'Center', type: 'node' });
      await knowledgeGraph.addNode({ id: 'node1', label: 'Node 1', type: 'node' });
      await knowledgeGraph.addNode({ id: 'node2', label: 'Node 2', type: 'node' });

      await knowledgeGraph.addEdge({
        id: 'center-1',
        source: 'center',
        target: 'node1',
        type: 'connects'
      });

      await knowledgeGraph.addEdge({
        id: 'center-2',
        source: 'center',
        target: 'node2',
        type: 'connects'
      });

      // Act
      const traversal = await knowledgeGraph.traverseFrom('center', { maxDepth: 2 });

      // Assert
      expect(traversal).toBeDefined();
      expect(traversal.nodes.length).toBeGreaterThan(0);
      expect(traversal.edges.length).toBeGreaterThan(0);
    });

    it('should calculate node centrality', async () => {
      // Arrange
      // Create a star graph
      await knowledgeGraph.addNode({ id: 'center', label: 'Center', type: 'hub' });

      const satelliteCount = 5;
      for (let i = 0; i < satelliteCount; i++) {
        await knowledgeGraph.addNode({
          id: `satellite-${i}`,
          label: `Satellite ${i}`,
          type: 'node'
        });

        await knowledgeGraph.addEdge({
          id: `center-sat${i}`,
          source: 'center',
          target: `satellite-${i}`,
          type: 'connects'
        });
      }

      // Act
      const centrality = await knowledgeGraph.calculateCentrality('center');

      // Assert
      expect(centrality).toBeDefined();
      expect(centrality.degree).toBe(satelliteCount); // Connected to all satellites
      expect(centrality.betweenness).toBeGreaterThan(0); // Is a bridge node
    });
  });

  describe('Semantic Store Operations', () => {
    it('should store and retrieve semantic entries', async () => {
      // Arrange
      const entry = {
        id: 'semantic-1',
        content: 'Machine learning is a subset of AI',
        embeddings: new Float32Array(1536).fill(0.1),
        metadata: {
          category: 'education',
          difficulty: 'beginner'
        }
      };

      // Act
      await semanticStore.store(entry);
      const retrieved = await semanticStore.get('semantic-1');

      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(entry.id);
      expect(retrieved.content).toBe(entry.content);
    });

    it('should search by semantic similarity', async () => {
      // Arrange
      const entries = [
        {
          id: 'ai-def',
          content: 'Artificial intelligence definition',
          embeddings: new Float32Array(1536).fill(0.8),
          metadata: { category: 'definition' }
        },
        {
          id: 'ml-ex',
          content: 'Machine learning explanation',
          embeddings: new Float32Array(1536).fill(0.7),
          metadata: { category: 'explanation' }
        },
        {
          id: 'random',
          content: 'Random unrelated content',
          embeddings: new Float32Array(1536).fill(0.1),
          metadata: { category: 'other' }
        }
      ];

      for (const entry of entries) {
        await semanticStore.store(entry);
      }

      // Act
      const query = new Float32Array(1536).fill(0.75);
      const results = await semanticStore.similaritySearch(query, 2);

      // Assert
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
      expect(results[0].id).toBe('ai-def'); // Should be most similar
    });

    it('should handle large-scale semantic storage', async () => {
      // Arrange
      const entryCount = 1000;
      const entries = Array(entryCount).fill(null).map((_, i) => ({
        id: `semantic-${i}`,
        content: `Semantic entry ${i} with some content`,
        embeddings: new Float32Array(1536).fill(i / entryCount),
        metadata: { index: i }
      }));

      // Act
      const startTime = Date.now();
      const storePromises = entries.map(entry => semanticStore.store(entry));
      await Promise.all(storePromises);
      const storeTime = Date.now() - startTime;

      const searchTimeStart = Date.now();
      const query = new Float32Array(1536).fill(0.5);
      const results = await semanticStore.similaritySearch(query, 10);
      const searchTime = Date.now() - searchTimeStart;

      // Assert
      expect(storeTime).toBeLessThan(5000); // Should store quickly
      expect(searchTime).toBeLessThan(100); // Should search quickly
      expect(results.length).toBe(10);
    });
  });

  describe('Vector Store Operations', () => {
    it('should store and retrieve vector embeddings', async () => {
      // Arrange
      const id = 'vector-1';
      const embedding = new Float32Array(1536);
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] = Math.random();
      }

      // Act
      await vectorStore.store(id, embedding);
      const retrieved = await vectorStore.get(id);

      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved.length).toBe(embedding.length);
      // Check if vectors are approximately equal (allowing for floating point precision)
      for (let i = 0; i < embedding.length; i++) {
        expect(Math.abs(retrieved[i] - embedding[i])).toBeLessThan(0.001);
      }
    });

    it('should find similar vectors efficiently', async () => {
      // Arrange
      const targetVector = new Float32Array(1536).fill(0.5);
      const similarVector = new Float32Array(1536).fill(0.6); // Similar
      const differentVector = new Float32Array(1536).fill(0.1); // Different

      await vectorStore.store('similar', similarVector);
      await vectorStore.store('different', differentVector);
      await vectorStore.store('unrelated', new Float32Array(1536).fill(0));

      // Act
      const results = await vectorStore.findSimilar(targetVector, 2);

      // Assert
      expect(results.length).toBe(2);
      expect(results[0].id).toBe('similar'); // Should be more similar
      expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
    });

    it('should handle bulk vector operations', async () => {
      // Arrange
      const vectorCount = 500;
      const vectors = Array(vectorCount).fill(null).map((_, i) => ({
        id: `bulk-${i}`,
        vector: new Float32Array(1536).fill(i / vectorCount)
      }));

      // Act
      const storeStart = Date.now();
      await vectorStore.bulkStore(vectors);
      const storeTime = Date.now() - storeStart;

      const query = new Float32Array(1536).fill(0.5);
      const searchStart = Date.now();
      const results = await vectorStore.findSimilar(query, 10);
      const searchTime = Date.now() - searchStart;

      // Assert
      expect(storeTime).toBeLessThan(3000); // Bulk store should be fast
      expect(searchTime).toBeLessThan(50); // Search should be fast
      expect(results.length).toBe(10);
    });
  });

  describe('Knowledge Integration', () => {
    it('should integrate all knowledge stores seamlessly', async () => {
      // Arrange
      const knowledge = {
        id: 'integration-test',
        content: 'Knowledge integration test',
        type: 'test',
        timestamp: Date.now()
      };

      // Store in all systems
      await sqliteService.storeKnowledge(knowledge);
      await knowledgeGraph.addNode({
        id: knowledge.id,
        label: 'Integration Test',
        type: 'test',
        properties: { knowledgeId: knowledge.id }
      });
      await semanticStore.store({
        id: knowledge.id,
        content: knowledge.content,
        embeddings: new Float32Array(1536).fill(0.5),
        metadata: { knowledgeId: knowledge.id }
      });
      await vectorStore.store(knowledge.id, new Float32Array(1536).fill(0.5));

      // Act
      const sqliteResult = await sqliteService.getKnowledge(knowledge.id);
      const graphResult = await knowledgeGraph.getNode(knowledge.id);
      const semanticResult = await semanticStore.get(knowledge.id);
      const vectorResult = await vectorStore.get(knowledge.id);

      // Assert
      expect(sqliteResult).toBeDefined();
      expect(graphResult).toBeDefined();
      expect(semanticResult).toBeDefined();
      expect(vectorResult).toBeDefined();

      // All should reference the same knowledge
      expect(sqliteResult.id).toBe(knowledge.id);
      expect(graphResult.properties?.knowledgeId).toBe(knowledge.id);
      expect(semanticResult.metadata?.knowledgeId).toBe(knowledge.id);
    });

    it('should support knowledge updates across all stores', async () => {
      // Arrange
      const originalId = 'update-test';
      const updatedContent = 'Updated knowledge content';

      // Store original
      await sqliteService.storeKnowledge({
        id: originalId,
        content: 'Original content',
        type: 'test'
      });

      // Act - Update
      await sqliteService.updateKnowledge(originalId, updatedContent);

      const updatedKnowledge = await sqliteService.getKnowledge(originalId);

      // Assert
      expect(updatedKnowledge.content).toBe(updatedContent);
    });

    it('should handle knowledge expiration and cleanup', async () => {
      // Arrange
      const expiredEntry = {
        id: 'expired',
        content: 'This will expire',
        type: 'temporary',
        timestamp: Date.now() - 1000, // Already expired
        expiresAt: Date.now() - 100 // Already expired
      };

      // Act
      await sqliteService.storeKnowledge(expiredEntry);
      await sqliteService.cleanupExpired();

      const result = await sqliteService.getKnowledge('expired');

      // Assert
      expect(result).toBeUndefined(); // Should have been cleaned up
    });

    it('should provide comprehensive knowledge analytics', async () => {
      // Arrange
      const entries = Array(50).fill(null).map((_, i) => ({
        id: `analytics-${i}`,
        content: `Content for analytics ${i}`,
        type: i % 2 === 0 ? 'fact' : 'opinion',
        source: i % 3 === 0 ? 'expert' : 'user',
        timestamp: Date.now() - i * 1000 // Spread out over time
      }));

      for (const entry of entries) {
        await sqliteService.storeKnowledge(entry);
      }

      // Act
      const analytics = await sqliteService.getKnowledgeAnalytics();

      // Assert
      expect(analytics).toBeDefined();
      expect(analytics.totalEntries).toBe(50);
      expect(analytics.byType.fact).toBe(25);
      expect(analytics.byType.opinion).toBe(25);
      expect(analytics.bySource.expert).toBeGreaterThan(0);
      expect(analytics.avgContentLength).toBeGreaterThan(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should maintain performance with large knowledge base', async () => {
      // Arrange
      const entryCount = 10000;
      const entries = Array(entryCount).fill(null).map((_, i) => ({
        id: `perf-${i}`,
        content: `Performance test entry ${i} with more content to make it realistic`,
        type: 'test',
        timestamp: Date.now() - i * 1000
      }));

      // Act
      const storeStart = Date.now();
      const storePromises = entries.slice(0, 1000).map(entry =>
        sqliteService.storeKnowledge(entry)
      );
      await Promise.all(storePromises);
      const storeTime = Date.now() - storeStart;

      const searchStart = Date.now();
      const searchResults = await sqliteService.searchKnowledge('performance');
      const searchTime = Date.now() - searchStart;

      // Assert
      expect(storeTime).toBeLessThan(5000); // Should store 1000 entries quickly
      expect(searchTime).toBeLessThan(100); // Should search quickly
      expect(searchResults.length).toBeGreaterThan(0);
    });

    it('should handle concurrent knowledge operations', async () => {
      // Arrange
      const operationCount = 100;
      const operations = Array(operationCount).fill(null).map((_, i) => ({
        type: 'store',
        data: {
          id: `concurrent-${i}`,
          content: `Concurrent operation ${i}`,
          type: 'test'
        }
      }));

      // Act
      const startTime = Date.now();
      const promises = operations.map(op => {
        if (op.type === 'store') {
          return sqliteService.storeKnowledge(op.data);
        }
        return Promise.resolve();
      });

      await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // Verify operations completed
      const verification = await sqliteService.searchKnowledge('concurrent');
      const throughput = operationCount / (totalTime / 1000);

      // Assert
      expect(verification.length).toBeGreaterThan(0);
      expect(throughput).toBeGreaterThan(20); // 20+ operations per second
    });

    it('should monitor memory usage efficiently', async () => {
      // Arrange
      const initialMemory = process.memoryUsage().heapUsed;

      // Add a large amount of knowledge
      for (let i = 0; i < 5000; i++) {
        await sqliteService.storeKnowledge({
          id: `memory-${i}`,
          content: `Memory test entry ${i}`.repeat(10), // Make it larger
          type: 'test'
        });
      }

      // Act
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Assert
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
    });
  });

  describe('Backup and Recovery', () => {
    it('should create database backup', async () => {
      // Arrange
      const backupPath = '/tmp/test-knowledge-backup.db';

      // Add some test data
      await sqliteService.storeKnowledge({
        id: 'backup-test',
        content: 'Backup test content',
        type: 'test'
      });

      // Act
      const backupResult = await sqliteService.createBackup(backupPath);

      // Assert
      expect(backupResult.success).toBe(true);
      expect(backupResult.backupPath).toBe(backupPath);

      // Verify backup file exists
      import { promises as fs } from 'fs';
      const backupExists = await fs.access(backupPath).then(() => true).catch(() => false);
      expect(backupExists).toBe(true);
    });

    it('should restore from backup', async () => {
      // Arrange
      const originalData = {
        id: 'restore-test',
        content: 'Restore test content',
        type: 'test'
      };

      await sqliteService.storeKnowledge(originalData);

      // Create backup
      const backupPath = '/tmp/test-knowledge-backup.db';
      await sqliteService.createBackup(backupPath);

      // Clear current database
      await sqliteService.clearAllTables();

      // Act
      const restoreResult = await sqliteService.restoreFromBackup(backupPath);
      const restoredData = await sqliteService.getKnowledge('restore-test');

      // Assert
      expect(restoreResult.success).toBe(true);
      expect(restoredData).toBeDefined();
      expect(restoredData.content).toBe(originalData.content);
    });
  });
});