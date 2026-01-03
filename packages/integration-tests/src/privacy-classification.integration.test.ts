import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { IntentEncoder } from '@lsi/privacy';
import { PrivacyClassifier } from '@lsi/privacy';
import { RedactionAdditionProtocol } from '@lsi/privacy';
import { SecureVM } from '@lsi/privacy';
import { Firewall } from '@lsi/privacy';
import { QueryRefiner } from '@lsi/cascade';
import type { PrivacyClass, IntentVector, RedactionResult } from '@lsi/protocol';
import { PrivacyCategory } from '@lsi/protocol';

describe('Privacy Classification Integration Test Suite', () => {
  let intentEncoder: IntentEncoder;
  let privacyClassifier: PrivacyClassifier;
  let redactionAdditionProtocol: RedactionAdditionProtocol;
  let secureVM: SecureVM;
  let firewall: Firewall;
  let queryRefiner: QueryRefiner;

  beforeAll(async () => {
    // Initialize components
    intentEncoder = new IntentEncoder();
    privacyClassifier = new PrivacyClassifier({
      sensitivityThreshold: 0.7,
      piiConfidence: 0.8
    });
    redactionAdditionProtocol = new RedactionAdditionProtocol();
    secureVM = new SecureVM({
      allowedCommands: ['query', 'analyze', 'search'],
      maxMemory: 100 * 1024 * 1024, // 100MB
      timeout: 5000
    });
    firewall = new Firewall({
      allowedPatterns: [/^[a-zA-Z0-9\s\,\.\?\!]+$/],
      blockedPatterns: [/\b(password|ssn|credit|card)\b/i]
    });
    queryRefiner = new QueryRefiner();

    // Initialize all components
    await intentEncoder.initialize();
    await privacyClassifier.initialize();
    await redactionAdditionProtocol.initialize();
    await secureVM.initialize();
    await firewall.initialize();
  });

  afterAll(async () => {
    await intentEncoder.close();
    await privacyClassifier.close();
    await redactionAdditionProtocol.close();
    await secureVM.close();
    await firewall.close();
  });

  describe('Privacy Classification', () => {
    it('should classify LOGIC type queries correctly', async () => {
      // Arrange
      const logicQueries = [
        "What is the time complexity of quicksort?",
        "Explain the principles of object-oriented programming",
        "How do neural networks learn?",
        "What is the mathematical definition of a derivative?",
        "Explain the theory of relativity"
      ];

      // Act
      const classifications = await Promise.all(
        logicQueries.map(query => privacyClassifier.classify(query))
      );

      // Assert
      classifications.forEach((classification, index) => {
        expect(classification).toBeDefined();
        expect(classification.type).toBe('LOGIC');
        expect(classification.sensitivity).toBeLessThan(0.3);
        expect(classification.confidence).toBeGreaterThan(0.8);
        expect(classification.piiData).toEqual([]);
      });
    });

    it('should classify STYLE type queries correctly', async () => {
      // Arrange
      const styleQueries = [
        "Write a poem about artificial intelligence",
        "Explain quantum mechanics in simple terms",
        "How would you describe the beauty of mathematics?",
        "What's the best way to present data visualization?",
        "Write a story about AI helping humanity"
      ];

      // Act
      const classifications = await Promise.all(
        styleQueries.map(query => privacyClassifier.classify(query))
      );

      // Assert
      classifications.forEach((classification, index) => {
        expect(classification).toBeDefined();
        expect(classification.type).toBe('STYLE');
        expect(classification.sensitivity).toBeLessThan(0.5);
        expect(classification.confidence).toBeGreaterThan(0.7);

        // STYLE queries may contain some rephrased PII
        if (classification.piiData.length > 0) {
          expect(classification.rewrittenQuery).toBeDefined();
        }
      });
    });

    it('should classify SECRET type queries correctly', async () => {
      // Arrange
      const secretQueries = [
        "My password is 123456 and I need help",
        "My social security number is 123-45-6789",
        "My credit card number is 4532015112830366",
        "I live at 123 Main Street, New York",
        "My phone number is 555-123-4567"
      ];

      // Act
      const classifications = await Promise.all(
        secretQueries.map(query => privacyClassifier.classify(query))
      );

      // Assert
      classifications.forEach((classification, index) => {
        expect(classification).toBeDefined();
        expect(classification.type).toBe(PrivacyCategory.SECRET);
        expect(classification.sensitivity).toBeGreaterThan(0.7);
        expect(classification.confidence).toBeGreaterThan(0.8);
        expect(classification.piiData.length).toBeGreaterThan(0);
      });
    });

    it('should detect PII with high accuracy', async () => {
      // Arrange
      const queriesWithPII = [
        {
          query: "My email is john.doe@example.com",
          expectedPII: ['john.doe@example.com']
        },
        {
          query: "My SSN is 001-01-0011",
          expectedPII: ['001-01-0011']
        },
        {
          query: "My credit card is 4532 0151 1283 0366",
          expectedPII: ['4532 0151 1283 0366']
        },
        {
          query: "My phone is (555) 123-4567",
          expectedPII: ['(555) 123-4567']
        },
        {
          query: "My address is 1600 Amphitheatre Parkway, Mountain View",
          expectedPII: ['1600 Amphitheatre Parkway, Mountain View']
        }
      ];

      // Act
      const results = await Promise.all(
        queriesWithPII.map(item => privacyClassifier.classify(item.query))
      );

      // Assert
      results.forEach((result, index) => {
        expect(result.piiData.length).toBeGreaterThan(0);
        const item = queriesWithPII[index];

        // Check that all expected PII was detected
        item.expectedPII.forEach(expected => {
          const found = result.piiData.some(pi => pi.value.includes(expected));
          expect(found).toBe(true);
        });
      });
    });

    it('should provide detailed privacy analysis', async () => {
      // Arrange
      const complexQuery = "John Doe's phone number is 555-123-4567 and he lives at 123 Main St. His email is john@example.com and his SSN is 123-45-6789.";

      // Act
      const classification = await privacyClassifier.classify(complexQuery);

      // Assert
      expect(classification).toBeDefined();
      expect(classification.analysis).toBeDefined();
      expect(classification.analysis?.piiRiskLevel).toBe('HIGH');
      expect(classification.analysis?.compliance).toBe('GDPR, HIPAA');

      // Should detect multiple PII types
      const piiTypes = classification.piiData.map(pi => pi.type);
      expect(piiTypes).toContain('phone');
      expect(piiTypes).toContain('address');
      expect(piiTypes).toContain('email');
      expect(piiTypes).toContain('ssn');
    });
  });

  describe('Intent Encoding and Privacy', () => {
    it('should encode queries to 768-dimensional vectors', async () => {
      // Arrange
      const queries = [
        "What is artificial intelligence?",
        "Explain machine learning concepts",
        "How do neural networks work?"
      ];

      // Act
      const intentVectors = await Promise.all(
        queries.map(query => intentEncoder.encode(query))
      );

      // Assert
      intentVectors.forEach(vector => {
        expect(vector).toBeDefined();
        expect(vector.embedding).toBeInstanceOf(Float32Array);
        expect(vector.embedding.length).toBe(768);
        expect(vector.confidence).toBeGreaterThan(0);
        expect(vector.intent).toBeDefined();
      });
    });

    it('should preserve semantic meaning in intent vectors', async () => {
      // Arrange
      const similarQueries = [
        "What is AI?",
        "Define artificial intelligence",
        "Explain what artificial intelligence means"
      ];

      // Act
      const vectors = await Promise.all(
        similarQueries.map(query => intentEncoder.encode(query))
      );

      // Assert
      // Similar queries should have similar embeddings
      const similarity = cosineSimilarity(vectors[0].embedding, vectors[1].embedding);
      expect(similarity).toBeGreaterThan(0.7);

      const similarity2 = cosineSimilarity(vectors[0].embedding, vectors[2].embedding);
      expect(similarity2).toBeGreaterThan(0.7);
    });

    it('should detect privacy-preserving intents', async () => {
      // Arrange
      const privacyQuery = "I want to understand privacy policies without revealing personal information";

      // Act
      const intent = await intentEncoder.encode(privacyQuery);

      // Assert
      expect(intent).toBeDefined();
      expect(intent.privacyAware).toBe(true);
      expect(intent.intent?.category).toBe('educational');
      expect(intent.intent?.privacyConcern).toBe('high');
    });

    it('should encode sensitive queries securely', async () => {
      // Arrange
      const sensitiveQuery = "My password is secret123 and I need help";

      // Act
      const encoded = await intentEncoder.encode(sensitiveQuery);

      // Assert
      expect(encoded).toBeDefined();
      expect(encoded.secure).toBe(true);
      expect(encoded.piiRisk).toBe('HIGH');

      // The original sensitive data should not be in the encoding
      expect(encoded.embedding.toString()).not.toContain('secret123');
    });
  });

  describe('Redaction-Addition Protocol (R-A Protocol)', () => {
    it('should redact PII from queries before processing', async () => {
      // Arrange
      const query = "My name is John Smith and my phone is 555-123-4567";
      const context = {
        piiRedaction: true,
        retentionPolicies: ['temporary']
      };

      // Act
      const redacted = await redactionAdditionProtocol.redact(query, context);

      // Assert
      expect(redacted).toBeDefined();
      expect(redacted.redactedQuery).toContain('[NAME]');
      expect(redacted.redactedQuery).toContain('[PHONE]');
      expect(redacted.redactedQuery).not.toContain('John Smith');
      expect(redacted.redactedQuery).not.toContain('555-123-4567');
      expect(redacted.redactionMap).toBeDefined();
      expect(redacted.redactionMap?.size).toBeGreaterThan(0);
    });

    it('should reconstruct responses with original PII', async () => {
      // Arrange
      const originalQuery = "My phone is 555-123-4567";
      const redactedQuery = "My phone is [PHONE]";
      const response = "Your phone number has been updated successfully";
      const redactionMap = new Map([
        ['[PHONE]', '555-123-4567']
      ]);

      // Act
      const reconstructed = await redactionAdditionProtocol.reconstruct(
        redactedQuery,
        response,
        redactionMap
      );

      // Assert
      expect(reconstructed).toBeDefined();
      expect(reconstructed.response).toContain('555-123-4567');
      expect(reconstructed.redactedData).toBeDefined();
    });

    it('should maintain query semantics during redaction', async () => {
      // Arrange
      const query = "I need help with my account 12345";
      const context = {
        piiRedaction: true,
        semanticPreservation: true
      };

      // Act
      const redacted = await redactionAdditionProtocol.redact(query, context);

      // Assert
      expect(redacted).toBeDefined();
      expect(redacted.semanticScore).toBeGreaterThan(0.7);
      expect(redacted.redactedQuery).toContain('[ACCOUNT]');
    });

    it('should handle edge cases in redaction', async () => {
      // Arrange
      const edgeCases = [
        "", // Empty query
        "No PII here", // No PII
        "1234567890", // Numbers only
        "a@b.c", // Minimal email
        null, // Null query
        undefined // Undefined query
      ];

      // Act & Assert
      for (const query of edgeCases) {
        if (query === null || query === undefined) {
          await expect(redactionAdditionProtocol.redact(query as any, {}))
            .rejects.toThrow();
        } else {
          const result = await redactionAdditionProtocol.redact(query, {});
          expect(result).toBeDefined();
          expect(result.redactedQuery).toBeDefined();
        }
      }
    });
  });

  describe('Secure Virtual Machine (SecureVM)', () => {
    it('should execute queries in secure sandbox', async () => {
      // Arrange
      const query = "Calculate 2 + 2";

      // Act
      const result = await secureVM.execute(query);

      // Assert
      expect(result).toBeDefined();
      expect(result.output).toBe("4");
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.memoryUsed).toBeLessThan(1024 * 1024); // Less than 1MB
    });

    it('should block dangerous operations', async () => {
      // Arrange
      const dangerousQueries = [
        "rm -rf /", // Delete files
        "fetch('http://malicious.com/data')", // Network access
        "require('child_process').exec('rm -rf /')", // Process execution
        "eval('dangerous code')" // Code evaluation
      ];

      // Act & Assert
      for (const query of dangerousQueries) {
        const result = await secureVM.execute(query);
        expect(result.blocked).toBe(true);
        expect(result.reason).toBeDefined();
      }
    });

    it('should enforce resource limits', async () => {
      // Arrange
      const complexQuery = "Process a large dataset efficiently";

      // Act
      const result = await secureVM.execute(complexQuery);

      // Assert
      expect(result).toBeDefined();
      expect(result.memoryUsed).toBeLessThan(100 * 1024 * 1024); // 100MB limit
      expect(result.executionTime).toBeLessThan(5000); // 5 second timeout
    });

    it('should maintain isolation between queries', async () => {
      // Arrange
      const query1 = "Set global variable x = 10";
      const query2 = "Return x";

      // Act
      const result1 = await secureVM.execute(query1);
      const result2 = await secureVM.execute(query2);

      // Assert
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();

      // Query2 should not have access to variables from query1
      expect(result2.output).not.toBe("10");
    });
  });

  describe('Firewall Integration', () => {
    it('should block queries with malicious patterns', async () => {
      // Arrange
      const maliciousQueries = [
        "DROP TABLE users; --",
        "SELECT * FROM users WHERE password = 'hack'",
        "<script>alert('xss')</script>",
        "1; DROP TABLE users; --"
      ];

      // Act
      const results = await Promise.all(
        maliciousQueries.map(query => firewall.checkQuery(query))
      );

      // Assert
      results.forEach(result => {
        expect(result.allowed).toBe(false);
        expect(result.reason).toBeDefined();
        expect(result.patternMatched).toBeDefined();
      });
    });

    it('should allow safe queries to pass through', async () => {
      // Arrange
      const safeQueries = [
        "What is artificial intelligence?",
        "Explain machine learning",
        "Help me with my homework",
        "Tell me a joke"
      ];

      // Act
      const results = await Promise.all(
        safeQueries.map(query => firewall.checkQuery(query))
      );

      // Assert
      results.forEach(result => {
        expect(result.allowed).toBe(true);
        expect(result.reason).toBe('query_safe');
      });
    });

    it('should provide detailed blocking reasons', async () => {
      // Arrange
      const sqlInjection = "SELECT * FROM users WHERE id = 1 OR 1=1";

      // Act
      const result = await firewall.checkQuery(sqlInjection);

      // Assert
      expect(result).toBeDefined();
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('sql_injection_detected');
      expect(result.patternMatched).toBe('sql_injection');
    });
  });

  describe('Privacy Pipeline Integration', () => {
    it('should process queries through complete privacy pipeline', async () => {
      // Arrange
      const sensitiveQuery = "My password is secret123 and I need help resetting it";

      // Act
      const pipelineResult = await privacyClassifier.processWithPipeline(sensitiveQuery);

      // Assert
      expect(pipelineResult).toBeDefined();
      expect(pipelineResult.originalQuery).toBe(sensitiveQuery);
      expect(pipelineResult.privacyClassification).toBeDefined();
      expect(pipelineResult.intentEncoding).toBeDefined();
      expect(pipelineResult.redactedQuery).toBeDefined();
      expect(pipelineResult.finalQuery).toBeDefined();
    });

    it('should maintain privacy throughout processing', async () => {
      // Arrange
      const query = "John Smith's phone is 555-123-4567 and email is john@example.com";

      // Act
      const processed = await privacyClassifier.processWithPipeline(query);

      // Assert
      // PII should be removed at all stages
      expect(processed.redactedQuery).not.toContain('John Smith');
      expect(processed.redactedQuery).not.toContain('555-123-4567');
      expect(processed.finalQuery).not.toContain('john@example.com');
    });

    it('should provide audit trail for privacy processing', async () => {
      // Arrange
      const query = "Help with my account 12345";

      // Act
      const processed = await privacyClassifier.processWithPipeline(query);

      // Assert
      expect(processed.auditTrail).toBeDefined();
      expect(processed.auditTrail.length).toBeGreaterThan(0);

      // Each step should have a timestamp and result
      processed.auditTrail.forEach(step => {
        expect(step.timestamp).toBeDefined();
        expect(step.step).toBeDefined();
        expect(step.result).toBeDefined();
      });
    });

    it('should handle multiple PII types simultaneously', async () => {
      // Arrange
      const complexQuery = "John Doe (SSN: 123-45-6789) lives at 123 Main St, phone: 555-123-4567, email: john@example.com";

      // Act
      const processed = await privacyClassifier.processWithPipeline(complexQuery);

      // Assert
      expect(processed.piiData.length).toBeGreaterThanOrEqual(4); // name, ssn, address, phone, email

      // Should redact all PII types
      const redacted = processed.redactedQuery;
      expect(redacted).not.toContain('John Doe');
      expect(redacted).not.toContain('123-45-6789');
      expect(redacted).not.toContain('123 Main St');
      expect(redacted).not.toContain('555-123-4567');
      expect(redacted).not.toContain('john@example.com');
    });
  });

  describe('Performance and Reliability', () => {
    it('should maintain high throughput for privacy processing', async () => {
      // Arrange
      const queryCount = 100;
      const queries = Array(queryCount).fill("What is artificial intelligence?");

      // Act
      const startTime = Date.now();
      const results = await Promise.all(
        queries.map(query => privacyClassifier.classify(query))
      );
      const endTime = Date.now();

      // Assert
      const totalTime = endTime - startTime;
      const avgLatency = totalTime / queryCount;
      const throughput = queryCount / (totalTime / 1000);

      expect(avgLatency).toBeLessThan(50); // Average under 50ms
      expect(throughput).toBeGreaterThan(20); // 20+ queries per second
    });

    it('should handle privacy failures gracefully', async () => {
      // Arrange
      const errorQueries = [
        "", // Empty query
        "   ", // Whitespace
        "a".repeat(10000), // Very long query
        null, // Null query
        undefined // Undefined query
      ];

      // Act & Assert
      for (const query of errorQueries) {
        if (query === null || query === undefined) {
          await expect(privacyClassifier.classify(query as any))
            .rejects.toThrow();
        } else {
          const result = await privacyClassifier.classify(query);
          expect(result).toBeDefined();
          expect(result.type).toBe('LOGIC'); // Default fallback
        }
      }
    });

    it('should maintain memory efficiency', async () => {
      // Arrange
      const initialMemory = process.memoryUsage().heapUsed;

      // Process many queries
      const queries = Array(1000).fill(null).map((_, i) =>
        `Query ${i}: Some content about AI`
      );

      // Act
      const results = await Promise.all(
        queries.map(query => privacyClassifier.classify(query))
      );

      // Assert
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (< 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  // Helper function for cosine similarity
  function cosineSimilarity(a: Float32Array, b: Float32Array): number {
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

    return dotProduct / (magnitudeA * magnitudeB);
  }
});