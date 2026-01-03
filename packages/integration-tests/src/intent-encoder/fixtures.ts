/**
 * IntentEncoder Integration Test Fixtures
 *
 * Provides test fixtures for IntentEncoder integration tests including:
 * - Sample queries by privacy level
 * - Expected privacy loss values
 * - Dimensionality reduction test cases
 * - Reconstruction attack test cases
 * - Performance benchmark data
 *
 * @packageDocumentation
 */

import { PIIType, PrivacyLevel } from "@lsi/protocol";

/**
 * Sample queries categorized by privacy level
 */
export const sampleQueries = {
  /**
   * PUBLIC queries - Safe to transmit without modification
   * Pure reasoning, general knowledge, no PII
   */
  PUBLIC: [
    "What is the capital of France?",
    "How do I bake a chocolate cake?",
    "Explain quantum computing in simple terms",
    "What are the benefits of TypeScript?",
    "How does a binary search algorithm work?",
    "What is the difference between TCP and UDP?",
    "Explain the concept of recursion",
    "What are the main principles of object-oriented programming?",
    "How do you calculate the area of a circle?",
    "What is the theory of relativity?",
  ],

  /**
   * SENSITIVE queries - Personal information, needs careful handling
   * Contains PII but not high-severity secrets
   */
  SENSITIVE: [
    "I have a doctor appointment tomorrow at 3pm",
    "My email is john.doe@example.com",
    "I live at 123 Main Street, Springfield, IL",
    "What is the treatment for diabetes?",
    "I need to update my account information",
    "How do I change my password?",
    "When is my next credit card payment due?",
    "I work at Acme Corporation in the IT department",
    "My phone number is 555-123-4567",
    "What is the routing number for my bank?",
  ],

  /**
   * SOVEREIGN queries - High-severity secrets, must be protected
   * Contains sensitive PII that should never be transmitted
   */
  SOVEREIGN: [
    "My credit card number is 4532-1234-5678-9010",
    "My SSN is 123-45-6789",
    "My password is SuperSecret123!",
    "API key: sk-1234567890abcdef",
    "My passport number is X1234567",
    "Driver's license: CA1234567",
    "Bank account: 1234567890",
    "My medical record ID is MR-987654",
    "My date of birth is 01/15/1985",
    "What is my mother's maiden name for security verification?",
  ],
} as const;

/**
 * Expected privacy loss by epsilon value
 *
 * Privacy loss calculation: Δf / ε where Δf = 2.0 (sensitivity)
 */
export const privacyLossByEpsilon = {
  epsilon0_1: 20.0, // 2.0 / 0.1 = 20.0
  epsilon0_5: 4.0, // 2.0 / 0.5 = 4.0
  epsilon1_0: 2.0, // 2.0 / 1.0 = 2.0
  epsilon2_0: 1.0, // 2.0 / 2.0 = 1.0
  epsilon5_0: 0.4, // 2.0 / 5.0 = 0.4
  epsilon10_0: 0.2, // 2.0 / 10.0 = 0.2
} as const;

/**
 * Dimensionality reduction test cases
 *
 * Tests PCA transformation from 1536 to various output dimensions
 */
export const dimensionalityTests = [
  {
    input: 1536,
    output: 768,
    method: "pca",
    variancePreserved: 0.95,
  },
  {
    input: 1536,
    output: 512,
    method: "pca",
    variancePreserved: 0.9,
  },
  {
    input: 1536,
    output: 256,
    method: "pca",
    variancePreserved: 0.8,
  },
] as const;

/**
 * Reconstruction attack test cases
 *
 * These queries should NOT be reconstructable from intent vectors
 * Tests verify that encoded vectors do not leak sensitive information
 */
export const reconstructionTests = [
  {
    query: "My name is John Smith",
    sensitiveInfo: ["John", "Smith"],
    shouldFail: true,
    description: "Should not reconstruct name from intent vector",
  },
  {
    query: "I live in New York City",
    sensitiveInfo: ["New York", "NYC"],
    shouldFail: true,
    description: "Should not reconstruct location from intent vector",
  },
  {
    query: "My phone is 555-1234",
    sensitiveInfo: ["555-1234"],
    shouldFail: true,
    description: "Should not reconstruct phone number from intent vector",
  },
  {
    query: "Email me at jane@example.org",
    sensitiveInfo: ["jane@example.org"],
    shouldFail: true,
    description: "Should not reconstruct email from intent vector",
  },
  {
    query: "My SSN is 123-45-6789",
    sensitiveInfo: ["123-45-6789"],
    shouldFail: true,
    description: "Should not reconstruct SSN from intent vector",
  },
] as const;

/**
 * Semantic similarity test pairs
 *
 * Pairs of queries that should have high semantic similarity
 */
export const similarQueryPairs = [
  {
    query1: "What is the treatment for diabetes?",
    query2: "How do you treat diabetes?",
    expectedMinSimilarity: 0.85,
    description: "Rephrased medical question",
  },
  {
    query1: "What causes diabetes?",
    query2: "Diabetes symptoms and causes",
    expectedMinSimilarity: 0.8,
    description: "Related medical query",
  },
  {
    query1: "How do I reset my password?",
    query2: "Password reset instructions",
    expectedMinSimilarity: 0.85,
    description: "Account-related query",
  },
  {
    query1: "What is machine learning?",
    query2: "Explain machine learning algorithms",
    expectedMinSimilarity: 0.82,
    description: "Technical concept explanation",
  },
  {
    query1: "My email is test@example.com",
    query2: "Contact me at test@example.com",
    expectedMinSimilarity: 0.88,
    description: "Same email in different context",
  },
] as const;

/**
 * Dissimilar query pairs
 *
 * Pairs of queries that should have low semantic similarity
 */
export const dissimilarQueryPairs = [
  {
    query1: "What is the capital of France?",
    query2: "How do I bake a cake?",
    expectedMaxSimilarity: 0.5,
    description: "Completely different topics",
  },
  {
    query1: "Explain quantum physics",
    query2: "My password is secret123",
    expectedMaxSimilarity: 0.4,
    description: "Technical vs personal",
  },
  {
    query1: "What are the benefits of exercise?",
    query2: "How do I format a hard drive?",
    expectedMaxSimilarity: 0.45,
    description: "Health vs technology",
  },
] as const;

/**
 * Batch encoding test data
 *
 * Various batch sizes for performance testing
 */
export const batchTestSizes = [1, 5, 10, 25, 50, 100] as const;

/**
 * Performance benchmark targets
 *
 * Expected performance characteristics for IntentEncoder
 */
export const performanceTargets = {
  singleQueryLatency: {
    target: 100, // ms
    warning: 500, // ms
    critical: 1000, // ms
  },
  batchThroughput: {
    target: 10, // queries/second
    warning: 5, // queries/second
    critical: 1, // queries/second
  },
  memoryUsage: {
    target: 50, // MB
    warning: 100, // MB
    critical: 200, // MB
  },
  cacheHitRate: {
    target: 0.8, // 80%
    warning: 0.5, // 50%
    critical: 0.2, // 20%
  },
} as const;

/**
 * PII detection test cases
 *
 * Queries with known PII types for classifier testing
 */
export const piiDetectionTests = [
  {
    query: "Email to john@example.com",
    expectedPII: [PIIType.EMAIL],
    level: PrivacyLevel.SOVEREIGN,
  },
  {
    query: "Phone: 555-123-4567",
    expectedPII: [PIIType.PHONE],
    level: PrivacyLevel.SOVEREIGN,
  },
  {
    query: "SSN: 123-45-6789",
    expectedPII: [PIIType.SSN],
    level: PrivacyLevel.SOVEREIGN,
  },
  {
    query: "Card: 4111-1111-1111-1111",
    expectedPII: [PIIType.CREDIT_CARD],
    level: PrivacyLevel.SOVEREIGN,
  },
  {
    query: "IP: 192.168.1.1",
    expectedPII: [PIIType.IP_ADDRESS],
    level: PrivacyLevel.SENSITIVE,
  },
  {
    query: "DOB: 01/15/1985",
    expectedPII: [PIIType.DATE_OF_BIRTH],
    level: PrivacyLevel.SOVEREIGN,
  },
  {
    query: "Address: 123 Main St, Springfield, IL 62701",
    expectedPII: [PIIType.ADDRESS, PIIType.NAME],
    level: PrivacyLevel.SOVEREIGN,
  },
  {
    query: "Contact John Smith",
    expectedPII: [PIIType.NAME],
    level: PrivacyLevel.SENSITIVE,
  },
] as const;

/**
 * Epsilon selection guidelines
 *
 * Recommended epsilon values for different privacy scenarios
 */
export const epsilonGuidelines = {
  highlySensitive: {
    epsilon: 0.1,
    useCases: ["Medical records", "Financial data", "SSN", "Credit cards"],
    description: "Strong privacy, low utility",
  },
  sensitive: {
    epsilon: 0.5,
    useCases: ["Personal queries", "Email", "Phone", "Address"],
    description: "Moderate privacy, medium utility",
  },
  generalPurpose: {
    epsilon: 1.0,
    useCases: ["General queries", "Mixed sensitivity"],
    description: "Balanced privacy and utility",
  },
  analytics: {
    epsilon: 2.0,
    useCases: ["Non-sensitive analytical queries", "Aggregated data"],
    description: "Weak privacy, high utility",
  },
  publicData: {
    epsilon: 5.0,
    useCases: ["Public data", "Anonymized analytics"],
    description: "Very weak privacy, very high utility",
  },
} as const;

/**
 * Edge case queries for robustness testing
 */
export const edgeCaseQueries = [
  "",
  "   ",
  "a",
  "A very long query " + "that repeats ".repeat(100),
  "Query with emojis 😀🎉🚀",
  "Query\nwith\nnewlines",
  "Query\twith\ttabs",
  "QUERY IN ALL CAPS",
  "query in all lowercase",
  "Query With Mixed Case",
  "1234567890",
  "!@#$%^&*()",
  "Query with multiple   spaces",
  "Query with punctuation, periods, commas! and exclamation?",
] as const;

/**
 * Multi-turn conversation scenarios
 */
export const conversationScenarios = [
  {
    turns: ["My name is Alice", "What is my name?", "Tell me my name again"],
    context: "Name reference across turns",
  },
  {
    turns: [
      "I live in New York",
      "What is the weather in my city?",
      "Is it raining where I live?",
    ],
    context: "Location reference across turns",
  },
  {
    turns: [
      "My email is alice@example.com",
      "Send me an email",
      "What is my email address?",
    ],
    context: "Email reference across turns",
  },
] as const;

/**
 * Intent vector validation helpers
 */
export const vectorValidation = {
  expectedDimension: 768,
  minNorm: 0.99,
  maxNorm: 1.01,
  minSimilarityForIdentical: 0.95,
  maxSimilarityForRandom: 0.3,
  maxSimilarityForUnrelated: 0.6,
  minSimilarityForRelated: 0.7,
} as const;

/**
 * Test configuration options
 */
export const testConfig = {
  defaultEpsilon: 1.0,
  defaultTimeout: 30000, // ms
  slowTestThreshold: 5000, // ms
  batchSize: 10,
  maxConcurrent: 5,
} as const;
