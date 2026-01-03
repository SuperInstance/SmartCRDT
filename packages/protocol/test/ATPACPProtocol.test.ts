/**
 * ATP/ACP Protocol Tests
 *
 * Comprehensive tests for ATP (Autonomous Task Processing) and
 * ACP (Assisted Collaborative Processing) protocols.
 */

import { describe, it, expect } from 'vitest';
import {
  IntentCategory,
  Urgency,
  CollaborationMode,
  type ATPacket,
  type ACPHandshake,
  type AequorResponse,
  ProtocolErrorType,
  type ProtocolError,
  PrivacyLevel,
  type PrivacyClassification,
  PIIType,
  type IntentVector,
  type IntentEncoderConfig,
  type RedactionResult,
  type RedactionContext,
} from '../src/atp-acp.js';

describe('ATP Protocol Tests', () => {
  describe('ATPacket Validation', () => {
    it('should accept valid ATP packet with all required fields', () => {
      const packet: ATPacket = {
        id: 'test-123',
        query: 'What is the weather?',
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      expect(packet.id).toBeDefined();
      expect(packet.query).toBeDefined();
      expect(packet.intent).toBeDefined();
      expect(packet.urgency).toBeDefined();
      expect(packet.timestamp).toBeDefined();
    });

    it('should accept valid ATP packet with optional context', () => {
      const packet: ATPacket = {
        id: 'test-with-context',
        query: 'What is AI?',
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
        context: { userId: 'user-456', sessionId: 'session-789' },
      };

      expect(packet.context).toBeDefined();
      expect(packet.context?.userId).toBe('user-456');
    });

    it('should accept empty query string (edge case)', () => {
      const packet: ATPacket = {
        id: 'empty-query',
        query: '',
        intent: IntentCategory.UNKNOWN,
        urgency: Urgency.LOW,
        timestamp: Date.now(),
      };

      expect(packet.query).toBe('');
    });

    it('should accept very long query string', () => {
      const longQuery = 'a'.repeat(10000);
      const packet: ATPacket = {
        id: 'long-query',
        query: longQuery,
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      expect(packet.query.length).toBe(10000);
    });

    it('should accept unicode characters in query', () => {
      const unicodeQuery = 'Hello 世界 🌍 Привет';
      const packet: ATPacket = {
        id: 'unicode-query',
        query: unicodeQuery,
        intent: IntentCategory.CONVERSATION,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
      };

      expect(packet.query).toBe(unicodeQuery);
    });

    it('should accept all IntentCategory values', () => {
      const intents = [
        IntentCategory.QUERY,
        IntentCategory.COMMAND,
        IntentCategory.CONVERSATION,
        IntentCategory.CODE_GENERATION,
        IntentCategory.ANALYSIS,
        IntentCategory.CREATIVE,
        IntentCategory.DEBUGGING,
        IntentCategory.SYSTEM,
        IntentCategory.UNKNOWN,
      ];

      intents.forEach((intent) => {
        const packet: ATPacket = {
          id: `test-${intent}`,
          query: 'Test query',
          intent,
          urgency: Urgency.NORMAL,
          timestamp: Date.now(),
        };

        expect(packet.intent).toBe(intent);
      });
    });

    it('should accept all Urgency values', () => {
      const urgencies = [
        Urgency.LOW,
        Urgency.NORMAL,
        Urgency.HIGH,
        Urgency.CRITICAL,
      ];

      urgencies.forEach((urgency) => {
        const packet: ATPacket = {
          id: `test-${urgency}`,
          query: 'Test query',
          intent: IntentCategory.QUERY,
          urgency,
          timestamp: Date.now(),
        };

        expect(packet.urgency).toBe(urgency);
      });
    });

    it('should accept timestamp as number', () => {
      const timestamp = 1704067200000; // 2024-01-01
      const packet: ATPacket = {
        id: 'timestamp-test',
        query: 'Test query',
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp,
      };

      expect(packet.timestamp).toBe(timestamp);
    });

    it('should accept zero timestamp', () => {
      const packet: ATPacket = {
        id: 'zero-timestamp',
        query: 'Test query',
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: 0,
      };

      expect(packet.timestamp).toBe(0);
    });

    it('should accept context with various data types', () => {
      const packet: ATPacket = {
        id: 'context-types',
        query: 'Test query',
        intent: IntentCategory.QUERY,
        urgency: Urgency.NORMAL,
        timestamp: Date.now(),
        context: {
          string: 'value',
          number: 42,
          boolean: true,
          null: null,
          array: [1, 2, 3],
          nested: { key: 'value' },
        },
      };

      expect(packet.context?.nested).toBeDefined();
    });
  });

  describe('ACP Handshake Validation', () => {
    it('should accept valid ACP handshake with sequential mode', () => {
      const handshake: ACPHandshake = {
        id: 'acp-123',
        models: ['llama3.2', 'mistral'],
        query: 'Design a secure system',
        intent: IntentCategory.ANALYSIS,
        collaborationMode: CollaborationMode.SEQUENTIAL,
        timestamp: Date.now(),
      };

      expect(handshake.collaborationMode).toBe(CollaborationMode.SEQUENTIAL);
    });

    it('should accept valid ACP handshake with parallel mode', () => {
      const handshake: ACPHandshake = {
        id: 'acp-parallel',
        models: ['llama3.2', 'mistral', 'codellama'],
        query: 'Analyze this from multiple perspectives',
        intent: IntentCategory.ANALYSIS,
        collaborationMode: CollaborationMode.PARALLEL,
        timestamp: Date.now(),
      };

      expect(handshake.collaborationMode).toBe(CollaborationMode.PARALLEL);
    });

    it('should accept valid ACP handshake with cascade mode', () => {
      const handshake: ACPHandshake = {
        id: 'acp-cascade',
        models: ['model1', 'model2', 'model3'],
        query: 'Refine this answer',
        intent: IntentCategory.QUERY,
        collaborationMode: CollaborationMode.CASCADE,
        timestamp: Date.now(),
      };

      expect(handshake.collaborationMode).toBe(CollaborationMode.CASCADE);
    });

    it('should accept valid ACP handshake with ensemble mode', () => {
      const handshake: ACPHandshake = {
        id: 'acp-ensemble',
        models: ['model1', 'model2', 'model3'],
        query: 'Vote on the best answer',
        intent: IntentCategory.QUERY,
        collaborationMode: CollaborationMode.ENSEMBLE,
        timestamp: Date.now(),
      };

      expect(handshake.collaborationMode).toBe(CollaborationMode.ENSEMBLE);
    });

    it('should accept single model in ACP handshake', () => {
      const handshake: ACPHandshake = {
        id: 'acp-single',
        models: ['llama3.2'],
        query: 'Test query',
        intent: IntentCategory.QUERY,
        collaborationMode: CollaborationMode.SEQUENTIAL,
        timestamp: Date.now(),
      };

      expect(handshake.models.length).toBe(1);
    });

    it('should accept many models in ACP handshake', () => {
      const models = Array.from({ length: 10 }, (_, i) => `model-${i}`);
      const handshake: ACPHandshake = {
        id: 'acp-many',
        models,
        query: 'Test query',
        intent: IntentCategory.QUERY,
        collaborationMode: CollaborationMode.PARALLEL,
        timestamp: Date.now(),
      };

      expect(handshake.models.length).toBe(10);
    });

    it('should accept empty models array (edge case)', () => {
      const handshake: ACPHandshake = {
        id: 'acp-empty',
        models: [],
        query: 'Test query',
        intent: IntentCategory.QUERY,
        collaborationMode: CollaborationMode.SEQUENTIAL,
        timestamp: Date.now(),
      };

      expect(handshake.models).toEqual([]);
    });
  });

  describe('AequorResponse Validation', () => {
    it('should accept valid response for ATP', () => {
      const response: AequorResponse = {
        id: 'resp-123',
        content: 'This is the answer',
        protocol: 'ATP',
        models: 'llama3.2',
        backend: 'local',
        confidence: 0.9,
        latency: 100,
      };

      expect(response.protocol).toBe('ATP');
      expect(response.models).toBe('llama3.2');
    });

    it('should accept valid response for ACP', () => {
      const response: AequorResponse = {
        id: 'resp-acp',
        content: 'Combined answer',
        protocol: 'ACP',
        models: ['llama3.2', 'mistral'],
        backend: 'cloud',
        confidence: 0.85,
        latency: 500,
      };

      expect(response.protocol).toBe('ACP');
      expect(Array.isArray(response.models)).toBe(true);
    });

    it('should accept response with tokens used', () => {
      const response: AequorResponse = {
        id: 'resp-tokens',
        content: 'Answer',
        protocol: 'ATP',
        models: 'llama3.2',
        backend: 'local',
        confidence: 0.9,
        latency: 100,
        tokensUsed: 42,
      };

      expect(response.tokensUsed).toBe(42);
    });

    it('should accept response with fromCache flag', () => {
      const response: AequorResponse = {
        id: 'resp-cache',
        content: 'Cached answer',
        protocol: 'ATP',
        models: 'llama3.2',
        backend: 'local',
        confidence: 0.9,
        latency: 5,
        fromCache: true,
      };

      expect(response.fromCache).toBe(true);
    });

    it('should accept response with metadata', () => {
      const response: AequorResponse = {
        id: 'resp-metadata',
        content: 'Answer',
        protocol: 'ATP',
        models: 'llama3.2',
        backend: 'local',
        confidence: 0.9,
        latency: 100,
        metadata: { temperature: 0.7, topP: 0.9 },
      };

      expect(response.metadata).toBeDefined();
    });

    it('should accept all backend types', () => {
      const backends: Array<'local' | 'cloud' | 'hybrid'> = ['local', 'cloud', 'hybrid'];

      backends.forEach((backend) => {
        const response: AequorResponse = {
          id: `resp-${backend}`,
          content: 'Answer',
          protocol: 'ATP',
          models: 'llama3.2',
          backend,
          confidence: 0.9,
          latency: 100,
        };

        expect(response.backend).toBe(backend);
      });
    });

    it('should accept zero confidence', () => {
      const response: AequorResponse = {
        id: 'resp-zero-conf',
        content: 'Answer',
        protocol: 'ATP',
        models: 'llama3.2',
        backend: 'local',
        confidence: 0,
        latency: 100,
      };

      expect(response.confidence).toBe(0);
    });

    it('should accept perfect confidence', () => {
      const response: AequorResponse = {
        id: 'resp-perfect-conf',
        content: 'Answer',
        protocol: 'ATP',
        models: 'llama3.2',
        backend: 'local',
        confidence: 1,
        latency: 100,
      };

      expect(response.confidence).toBe(1);
    });
  });

  describe('ProtocolError', () => {
    it('should create error for invalid packet', () => {
      const error: ProtocolError = {
        type: ProtocolErrorType.INVALID_PACKET,
        message: 'Packet format is invalid',
        requestId: 'req-123',
        timestamp: Date.now(),
      };

      expect(error.type).toBe(ProtocolErrorType.INVALID_PACKET);
    });

    it('should create error for unknown model', () => {
      const error: ProtocolError = {
        type: ProtocolErrorType.UNKNOWN_MODEL,
        message: 'Model not found',
        requestId: 'req-456',
        timestamp: Date.now(),
      };

      expect(error.type).toBe(ProtocolErrorType.UNKNOWN_MODEL);
    });

    it('should create error for timeout', () => {
      const error: ProtocolError = {
        type: ProtocolErrorType.TIMEOUT,
        message: 'Request timed out',
        requestId: 'req-789',
        timestamp: Date.now(),
      };

      expect(error.type).toBe(ProtocolErrorType.TIMEOUT);
    });

    it('should create error for model failure', () => {
      const error: ProtocolError = {
        type: ProtocolErrorType.MODEL_FAILURE,
        message: 'Model execution failed',
        requestId: 'req-abc',
        timestamp: Date.now(),
        details: { errorCode: 500 },
      };

      expect(error.type).toBe(ProtocolErrorType.MODEL_FAILURE);
      expect(error.details).toBeDefined();
    });

    it('should create error for access denied', () => {
      const error: ProtocolError = {
        type: ProtocolErrorType.ACCESS_DENIED,
        message: 'Permission denied',
        requestId: 'req-def',
        timestamp: Date.now(),
      };

      expect(error.type).toBe(ProtocolErrorType.ACCESS_DENIED);
    });

    it('should create error for rate limit', () => {
      const error: ProtocolError = {
        type: ProtocolErrorType.RATE_LIMITED,
        message: 'Too many requests',
        requestId: 'req-ghi',
        timestamp: Date.now(),
        details: { retryAfter: 60 },
      };

      expect(error.type).toBe(ProtocolErrorType.RATE_LIMITED);
    });

    it('should accept error with details', () => {
      const error: ProtocolError = {
        type: ProtocolErrorType.MODEL_FAILURE,
        message: 'Error occurred',
        requestId: 'req-details',
        timestamp: Date.now(),
        details: {
          code: 'ERR_001',
          stack: 'Error stack trace',
          metadata: { key: 'value' },
        },
      };

      expect(error.details?.metadata).toBeDefined();
    });
  });

  describe('Privacy Types', () => {
    it('should accept PUBLIC privacy level', () => {
      const classification: PrivacyClassification = {
        level: PrivacyLevel.PUBLIC,
        confidence: 0.95,
        piiTypes: [],
        reason: 'No PII detected',
      };

      expect(classification.level).toBe(PrivacyLevel.PUBLIC);
    });

    it('should accept SENSITIVE privacy level', () => {
      const classification: PrivacyClassification = {
        level: PrivacyLevel.SENSITIVE,
        confidence: 0.8,
        piiTypes: [PIIType.EMAIL],
        reason: 'Email detected',
      };

      expect(classification.level).toBe(PrivacyLevel.SENSITIVE);
    });

    it('should accept SOVEREIGN privacy level', () => {
      const classification: PrivacyClassification = {
        level: PrivacyLevel.SOVEREIGN,
        confidence: 0.9,
        piiTypes: [PIIType.SSN, PIIType.CREDIT_CARD],
        reason: 'Sensitive PII detected',
      };

      expect(classification.level).toBe(PrivacyLevel.SOVEREIGN);
    });

    it('should accept multiple PII types', () => {
      const piiTypes: PIIType[] = [
        PIIType.EMAIL,
        PIIType.PHONE,
        PIIType.SSN,
        PIIType.CREDIT_CARD,
        PIIType.IP_ADDRESS,
        PIIType.ADDRESS,
        PIIType.NAME,
        PIIType.DATE_OF_BIRTH,
        PIIType.PASSPORT,
        PIIType.DRIVERS_LICENSE,
        PIIType.BANK_ACCOUNT,
        PIIType.MEDICAL_RECORD,
      ];

      const classification: PrivacyClassification = {
        level: PrivacyLevel.SOVEREIGN,
        confidence: 0.95,
        piiTypes,
        reason: 'Multiple PII types',
      };

      expect(classification.piiTypes.length).toBe(12);
    });

    it('should accept zero confidence', () => {
      const classification: PrivacyClassification = {
        level: PrivacyLevel.PUBLIC,
        confidence: 0,
        piiTypes: [],
        reason: 'Unknown',
      };

      expect(classification.confidence).toBe(0);
    });

    it('should accept perfect confidence', () => {
      const classification: PrivacyClassification = {
        level: PrivacyLevel.PUBLIC,
        confidence: 1,
        piiTypes: [],
        reason: 'Certain',
      };

      expect(classification.confidence).toBe(1);
    });
  });

  describe('Intent Vector Types', () => {
    it('should accept 768-dimensional intent vector', () => {
      const vector = new Float32Array(768);
      for (let i = 0; i < 768; i++) {
        vector[i] = Math.random();
      }

      const intentVector: IntentVector = {
        vector,
        epsilon: 1.0,
        model: 'text-embedding-3-small',
        latency: 100,
        satisfiesDP: true,
      };

      expect(intentVector.vector.length).toBe(768);
    });

    it('should accept different epsilon values', () => {
      const epsilons = [0.1, 0.5, 1.0, 2.0, 5.0];

      epsilons.forEach((epsilon) => {
        const intentVector: IntentVector = {
          vector: new Float32Array(768),
          epsilon,
          model: 'text-embedding-3-small',
          latency: 100,
          satisfiesDP: true,
        };

        expect(intentVector.epsilon).toBe(epsilon);
      });
    });

    it('should accept zero latency', () => {
      const intentVector: IntentVector = {
        vector: new Float32Array(768),
        epsilon: 1.0,
        model: 'text-embedding-3-small',
        latency: 0,
        satisfiesDP: true,
      };

      expect(intentVector.latency).toBe(0);
    });

    it('should accept satisfiesDP false', () => {
      const intentVector: IntentVector = {
        vector: new Float32Array(768),
        epsilon: 1.0,
        model: 'text-embedding-3-small',
        latency: 100,
        satisfiesDP: false,
      };

      expect(intentVector.satisfiesDP).toBe(false);
    });
  });

  describe('Redaction Types', () => {
    it('should accept redaction result', () => {
      const result: RedactionResult = {
        redactedQuery: 'My email is [REDACTED]',
        context: {
          redactions: new Map([['[REDACTED]', 'user@example.com']]),
          piiTypes: [PIIType.EMAIL],
          timestamp: Date.now(),
        },
        redactionCount: 1,
      };

      expect(result.redactedQuery).toContain('[REDACTED]');
      expect(result.redactionCount).toBe(1);
    });

    it('should accept multiple redactions', () => {
      const result: RedactionResult = {
        redactedQuery: 'Email: [REDACTED-1], Phone: [REDACTED-2]',
        context: {
          redactions: new Map([
            ['[REDACTED-1]', 'user@example.com'],
            ['[REDACTED-2]', '+1-555-123-4567'],
          ]),
          piiTypes: [PIIType.EMAIL, PIIType.PHONE],
          timestamp: Date.now(),
        },
        redactionCount: 2,
      };

      expect(result.redactionCount).toBe(2);
    });

    it('should accept zero redactions', () => {
      const result: RedactionResult = {
        redactedQuery: 'No PII here',
        context: {
          redactions: new Map(),
          piiTypes: [],
          timestamp: Date.now(),
        },
        redactionCount: 0,
      };

      expect(result.redactionCount).toBe(0);
    });
  });
});
