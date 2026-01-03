/**
 * Basic Usage Examples for Knowledge Base
 */

const KnowledgeBase = require('../src/index');

async function demonstrateKnowledgeBase() {
  const kb = new KnowledgeBase({
    dbPath: './data/kb',
    modelPath: './models'
  });

  await kb.initialize();

  console.log('=== Knowledge Base Demo ===\n');

  // Add documents
  console.log('1. Adding documents...');
  await kb.addDocument({
    text: 'LSI is a framework for local semantic intelligence. It provides embedding generation, similarity search, and text generation capabilities.',
    metadata: { title: 'LSI Overview', category: 'documentation' }
  });

  await kb.addDocument({
    text: 'To authenticate API requests, include your API key in the Authorization header. The key should be prefixed with "Bearer ".',
    metadata: { title: 'API Authentication', category: 'api' }
  });

  await kb.addDocument({
    text: 'Vector embeddings are numerical representations of text that capture semantic meaning. Similar concepts have similar embeddings.',
    metadata: { title: 'Vector Embeddings', category: 'concepts' }
  });

  console.log('✓ Documents added\n');

  // Search
  console.log('2. Searching for "authentication"...');
  const results = await kb.search('authentication');
  console.log(`Found ${results.length} results:`);
  results.forEach(r => {
    console.log(`  - ${r.document.metadata.title}: ${(r.similarity * 100).toFixed(1)}% match`);
  });
  console.log();

  // Get related content
  if (results.length > 0) {
    console.log('3. Finding related content...');
    const related = await kb.search.suggestRelated(results[0].document.id);
    console.log(`Related documents: ${related.length}`);
    console.log();
  }

  // Get statistics
  console.log('4. Statistics:');
  const stats = await kb.getStats();
  console.log(JSON.stringify(stats, null, 2));

  await kb.close();
}

demonstrateKnowledgeBase().catch(console.error);
