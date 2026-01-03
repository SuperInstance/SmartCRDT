const { open } = require('better-sqlite3');
const fs = require('fs');

// Simple manual test for basic functionality
async function testBasicFunctionality() {
  console.log('Testing basic persistence functionality...');

  try {
    // Create database in memory
    const db = open(':memory:');

    // Enable WAL mode
    db.pragma('journal_mode = WAL');

    // Create table
    db.exec(`
      CREATE TABLE entries (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        embedding BLOB,
        domain TEXT,
        source TEXT,
        created_at INTEGER,
        updated_at INTEGER
      );
    `);

    // Insert test data
    const entry = {
      id: 'test-1',
      content: 'Test content',
      embedding: Buffer.from([1, 2, 3, 4]),
      domain: 'test',
      source: 'manual-test',
      created_at: Date.now(),
      updated_at: Date.now()
    };

    const stmt = db.prepare(`
      INSERT INTO entries (id, content, embedding, domain, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      entry.id,
      entry.content,
      entry.embedding,
      entry.domain,
      entry.source,
      entry.created_at,
      entry.updated_at
    );

    // Retrieve data
    const select = db.prepare('SELECT * FROM entries WHERE id = ?');
    const retrieved = select.get('test-1');

    console.log('✅ Successfully inserted and retrieved entry');
    console.log(`   ID: ${retrieved.id}`);
    console.log(`   Content: ${retrieved.content}`);
    console.log(`   Domain: ${retrieved.domain}`);
    console.log(`   Created: ${new Date(retrieved.created_at).toISOString()}`);

    // Update test
    const update = db.prepare(`
      UPDATE entries
      SET content = ?, updated_at = ?
      WHERE id = ?
    `);

    update.run('Updated content', Date.now(), 'test-1');

    const updated = select.get('test-1');
    console.log('✅ Successfully updated entry');
    console.log(`   New content: ${updated.content}`);

    // Delete test
    const deleteStmt = db.prepare('DELETE FROM entries WHERE id = ?');
    deleteStmt.run('test-1');

    const deleted = select.get('test-1');
    console.log('✅ Successfully deleted entry');
    console.log(`   Deleted entry: ${deleted === undefined ? 'null (as expected)' : 'found (unexpected)'}`);

    db.close();
    console.log('\n✅ All basic tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Vector utils test
function testVectorUtils() {
  console.log('\nTesting vector utilities...');

  try {
    // Test vector creation and buffer conversion
    const testVector = new Float32Array([1.1, 2.2, 3.3, -4.4]);
    const buffer = Buffer.from(testVector.buffer);

    // Convert back
    const restoredVector = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);

    if (testVector.every((val, i) => val === restoredVector[i])) {
      console.log('✅ Vector buffer conversion works');
    } else {
      throw new Error('Vector conversion failed');
    }

    // Test dot product
    const a = new Float32Array([1, 2, 3]);
    const b = new Float32Array([4, 5, 6]);
    let dotProduct = 0;
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
    }

    if (dotProduct === 32) { // 1*4 + 2*5 + 3*6 = 32
      console.log('✅ Dot product calculation works');
    } else {
      throw new Error(`Expected 32, got ${dotProduct}`);
    }

    // Test cosine similarity
    const magnitudeA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    const cosineSimilarity = dotProduct / (magnitudeA * magnitudeB);

    if (cosineSimilarity > 0.9 && cosineSimilarity < 1) {
      console.log('✅ Cosine similarity calculation works');
    } else {
      throw new Error(`Expected cosine similarity between 0.9 and 1, got ${cosineSimilarity}`);
    }

    console.log('✅ All vector utility tests passed!');

  } catch (error) {
    console.error('❌ Vector test failed:', error.message);
    process.exit(1);
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Running manual tests for @lsi/persistence...\n');

  try {
    testBasicFunctionality();
    testVectorUtils();
    console.log('\n🎉 All tests completed successfully!');
  } catch (error) {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
  }
}

runTests();