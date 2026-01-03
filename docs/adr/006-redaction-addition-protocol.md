# ADR 006: Redaction-Addition Protocol

**Status:** Accepted
**Date:** 2025-02-10
**Deciders:** Aequor Core Team
**Related:** ADR-001 (Protocol-First Design), ADR-004 (Intent Vectors for Privacy)

---

## Context

AI systems often need to process sensitive information (PII, credentials, confidential data) while still leveraging cloud AI capabilities. The challenge is:

### The Privacy Dilemma

```typescript
// Dilemma: Need cloud AI capability but must protect sensitive data

const query = "My SSN is 123-45-6789 and I need help with my taxes";

// Option 1: Send raw query (insecure)
await openaiClient.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: query }]  // SSN exposed!
});

// Option 2: Don't send (no capability)
// Can't use cloud AI at all

// Option 3: Simple redaction (loses context)
await openaiClient.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: "My SSN is [REDACTED] and I need help with my taxes" }]
  // Cloud AI doesn't know what [REDACTED] is, loses context
});
```

### Problems with Simple Redaction

| Approach | Problem |
|----------|---------|
| **Remove entirely** | "My SSN is and I need help with my taxes" (broken) |
| **Replace with [REDACTED]** | Loses semantic meaning, awkward queries |
| **Replace with fake data** | "My SSN is 000-00-0000" (confusing) |
| **Don't send sensitive queries** | No cloud capability for sensitive tasks |

### The Opportunity

**Redaction-Addition Protocol (R-A Protocol)** provides:

1. **Local Redaction** - Remove sensitive data locally
2. **Structural Query** - Send query structure (preserves meaning)
3. **Cloud Processing** - Cloud AI processes without seeing sensitive data
4. **Local Re-hydration** - Restore sensitive context in response

**Result:** Functional privacy without sacrificing capability

---

## Decision

**Implement Redaction-Addition Protocol (R-A Protocol) for privacy-preserving cloud AI queries.**

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                  Redaction-Addition Protocol (R-A)               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. USER QUERY (with sensitive data)                             │
│     "My SSN is 123-45-6789 and I need help with my taxes"        │
│     │                                                             │
│     ▼                                                             │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              2. LOCAL REDACTION (Client-side)            │    │
│  │                                                           │    │
│  │  • Parse query (AST)                                      │    │
│  │  • Identify sensitive entities (SSN, name, etc.)          │    │
│  │  • Redact entities with type-preserving placeholders      │    │
│  │  • Store redaction metadata (for re-hydration)            │    │
│  │                                                           │    │
│  │  Output:                                                   │    │
│  │  Query: "My SSN is <SSN> and I need help with my taxes"   │    │
│  │  Metadata: {                                              │    │
│  │    redactions: [                                          │    │
│  │      { type: 'SSN', value: '123-45-6789', pos: [10,21] } │    │
│  │    ]                                                      │    │
│  │  }                                                        │    │
│  └──────────────────────────────────────────────────────────┘    │
│     │                                                             │
│     ▼                                                             │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │           3. STRUCTURAL QUERY (Send to cloud)            │    │
│  │                                                           │    │
│  │  POST /v1/chat/completions                                │    │
│  │  {                                                        │    │
│  │    "model": "gpt-4",                                      │    │
│  │    "messages": [{                                         │    │
│  │      "role": "user",                                     │    │
│  │      "content": "My SSN is <SSN> and I need help..."     │    │
│  │    }]                                                     │    │
│  │  }                                                        │    │
│  └──────────────────────────────────────────────────────────┘    │
│     │                                                             │
│     ▼                                                             │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              4. CLOUD PROCESSING (No sensitive data)      │    │
│  │                                                           │    │
│  │  Cloud AI receives: "My SSN is <SSN> and I need help..."  │    │
│  │  Cloud AI understands: User needs tax help for their SSN  │    │
│  │  Cloud AI processes: Without seeing actual SSN value     │    │
│  │                                                           │    │
│  │  Response: "For SSN <SSN>, you should file Form 1040..." │    │
│  └──────────────────────────────────────────────────────────┘    │
│     │                                                             │
│     ▼                                                             │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │            5. LOCAL RE-HYDRATION (Client-side)           │    │
│  │                                                           │    │
│  │  • Receive response from cloud                            │    │
│  │  • Identify placeholders in response                      │    │
│  │  • Replace with actual values from metadata               │    │
│  │                                                           │    │
│  │  Output:                                                   │    │
│  │  "For SSN 123-45-6789, you should file Form 1040..."      │    │
│  └──────────────────────────────────────────────────────────┘    │
│     │                                                             │
│     ▼                                                             │
│  6. FINAL RESPONSE (to user)                                      │
│     "For SSN 123-45-6789, you should file Form 1040..."           │
│                                                                   │
│  Key Benefits:                                                    │
│  • Cloud never sees sensitive data (123-45-6789)                 │
│  • Cloud understands semantic meaning (user has SSN)             │
│  • Response is complete and accurate                             │
│  • GDPR/HIPAA compliance                                         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Protocol Specification

#### Phase 1: Redaction (Local)

```typescript
// packages/privacy/src/protocol/RedactionAdditionProtocol.ts

export interface RedactionAdditionProtocol {
  /**
   * Redact sensitive information from query
   * @param query - Original query with sensitive data
   * @returns Redacted query with metadata
   */
  redact(query: string): Promise<RedactedQuery>;

  /**
   * Re-hydrate response with sensitive information
   * @param response - Response from cloud (with placeholders)
   * @param metadata - Redaction metadata from redact()
   * @returns Re-hydrated response with actual values
   */
  rehydrate(response: string, metadata: RedactionMetadata): Promise<string>;
}

export interface RedactedQuery {
  query: string;           // Redacted query
  metadata: RedactionMetadata;  // Metadata for re-hydration
}

export interface RedactionMetadata {
  queryId: string;         // Unique query identifier
  redactions: Redaction[];  // List of redactions
  timestamp: number;       // When query was redacted
}

export interface Redaction {
  type: EntityType;        // Type of entity (SSN, NAME, etc.)
  value: string;           // Original value (stored locally only!)
  placeholder: string;     // Placeholder to use (e.g., <SSN>)
  position: Position;      // Position in original query
}

export type EntityType =
  | 'SSN'           // Social Security Number
  | 'CREDIT_CARD'   // Credit card number
  | 'PASSWORD'      // Password/credential
  | 'API_KEY'       // API key/token
  | 'NAME'          // Person name
  | 'EMAIL'         // Email address
  | 'PHONE'         // Phone number
  | 'ADDRESS'       // Physical address
  | 'MEDICAL'       // Medical information
  | 'FINANCIAL'     // Financial information
  | 'CONFIDENTIAL'; // Confidential business data

export interface Position {
  start: number;    // Start index in query
  end: number;      // End index in query
}

// Implementation
export class RedactionAdditionProtocolImpl implements RedactionAdditionProtocol {
  private entityRecognizer: EntityRecognizer;

  constructor(entityRecognizer: EntityRecognizer) {
    this.entityRecognizer = entityRecognizer;
  }

  async redact(query: string): Promise<RedactedQuery> {
    // Step 1: Recognize sensitive entities
    const entities = await this.entityRecognizer.recognize(query);

    // Step 2: Sort by position (reverse order for replacement)
    entities.sort((a, b) => b.position.start - a.position.start);

    // Step 3: Replace entities with type-preserving placeholders
    let redactedQuery = query;
    const redactions: Redaction[] = [];

    for (const entity of entities) {
      const placeholder = this.generatePlaceholder(entity.type);

      redactedQuery =
        redactedQuery.slice(0, entity.position.start) +
        placeholder +
        redactedQuery.slice(entity.position.end);

      redactions.push({
        type: entity.type,
        value: entity.value,  // Stored locally only!
        placeholder: placeholder,
        position: entity.position
      });
    }

    return {
      query: redactedQuery,
      metadata: {
        queryId: this.generateQueryId(),
        redactions: redactions,
        timestamp: Date.now()
      }
    };
  }

  async rehydrate(
    response: string,
    metadata: RedactionMetadata
  ): Promise<string> {
    let rehydrated = response;

    // Replace placeholders with actual values
    for (const redaction of metadata.redactions) {
      // Replace all occurrences of placeholder
      rehydrated = rehydrated.replace(
        new RegExp(this.escapeRegex(redaction.placeholder), 'g'),
        redaction.value  // Use original value
      );
    }

    return rehydrated;
  }

  private generatePlaceholder(type: EntityType): string {
    // Type-preserving placeholder
    return `<${type}>`;
  }

  private generateQueryId(): string {
    return `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
```

#### Phase 2: Entity Recognition

```typescript
// packages/privacy/src/recognizer/EntityRecognizer.ts

export interface EntityRecognizer {
  /**
   * Recognize sensitive entities in text
   */
  recognize(text: string): Promise<Entity[]>;
}

export interface Entity {
  type: EntityType;
  value: string;
  position: Position;
  confidence: number;
}

// Implementation with regex patterns + ML classifier
export class EntityRecognizerImpl implements EntityRecognizer {
  private patterns: Map<EntityType, RegExp>;

  constructor() {
    // Initialize regex patterns for each entity type
    this.patterns = new Map([
      ['SSN', /\b\d{3}-\d{2}-\d{4}\b/g],
      ['CREDIT_CARD', /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g],
      ['EMAIL', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g],
      ['PHONE', /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g],
      // ... more patterns
    ]);
  }

  async recognize(text: string): Promise<Entity[]> {
    const entities: Entity[] = [];

    // Step 1: Pattern-based recognition
    for (const [type, pattern] of this.patterns.entries()) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match.index !== undefined) {
          entities.push({
            type: type as EntityType,
            value: match[0],
            position: {
              start: match.index,
              end: match.index + match[0].length
            },
            confidence: 0.9  // High confidence for regex matches
          });
        }
      }
    }

    // Step 2: ML-based recognition (for context-aware entities)
    const mlEntities = await this.recognizeWithML(text);
    entities.push(...mlEntities);

    // Step 3: Deduplicate (keep highest confidence per position)
    return this.deduplicate(entities);
  }

  private async recognizeWithML(text: string): Promise<Entity[]> {
    // Use ML model to recognize context-dependent entities
    // Examples: "my password is hunter2", "I live at 123 Main St"
    // This would use a trained NER model
    return [];
  }

  private deduplicate(entities: Entity[]): Entity[] {
    // Remove overlapping entities, keep highest confidence
    const result: Entity[] = [];

    for (const entity of entities) {
      const overlaps = result.some(e =>
        this.isOverlapping(e.position, entity.position)
      );

      if (!overlaps) {
        result.push(entity);
      } else {
        // Keep higher confidence
        const existing = result.find(e =>
          this.isOverlapping(e.position, entity.position)
        );
        if (existing && entity.confidence > existing.confidence) {
          Object.assign(existing, entity);
        }
      }
    }

    return result;
  }

  private isOverlapping(pos1: Position, pos2: Position): boolean {
    return !(pos1.end <= pos2.start || pos2.end <= pos1.start);
  }
}
```

### Example Usage

```typescript
// Initialize protocol
const entityRecognizer = new EntityRecognizerImpl();
const protocol = new RedactionAdditionProtocolImpl(entityRecognizer);

// Original query (with sensitive data)
const originalQuery = "My SSN is 123-45-6789 and I need help with my taxes";

// Phase 1: Redact (local)
const { query: redactedQuery, metadata } = await protocol.redact(originalQuery);

console.log(redactedQuery);
// "My SSN is <SSN> and I need help with my taxes"

console.log(metadata);
// {
//   queryId: "query-1707331200000-abc123",
//   redactions: [{
//     type: 'SSN',
//     value: '123-45-6789',  // Stored locally!
//     placeholder: '<SSN>',
//     position: { start: 10, end: 21 }
//   }],
//   timestamp: 1707331200000
// }

// Phase 2: Send to cloud (metadata stays local!)
const cloudResponse = await openaiClient.chat.completions.create({
  model: 'gpt-4',
  messages: [{
    role: 'user',
    content: redactedQuery  // "My SSN is <SSN> and I need help..."
  }]
});

console.log(cloudResponse.choices[0].message.content);
// "For SSN <SSN>, you should file Form 1040 by April 15th..."

// Phase 3: Re-hydrate (local)
const finalResponse = await protocol.rehydrate(
  cloudResponse.choices[0].message.content,
  metadata
);

console.log(finalResponse);
// "For SSN 123-45-6789, you should file Form 1040 by April 15th..."
```

---

## Advanced Features

### Contextual Redaction

```typescript
// Redact based on context, not just patterns
const query1 = "My SSN is 123-45-6789";  // Redact SSN
const query2 = "The format is XXX-XX-XXXX";  // Don't redact (example)

// Use ML to distinguish
class ContextualEntityRecognizer extends EntityRecognizerImpl {
  protected async recognizeWithML(text: string): Promise<Entity[]> {
    // Use ML to determine if context is sensitive
    const isSensitive = await this.classifyContext(text);

    if (!isSensitive) {
      return [];  // Don't redact if not sensitive
    }

    return super.recognizeWithML(text);
  }
}
```

### Partial Redaction

```typescript
// Redact partial information (preserve some context)
const query = "My credit card ending in 1234 has a $500 charge";

// Partial redaction: Keep last 4 digits
const redacted = "My credit card ending in **** has a $500 charge";

// Implementation
class PartialRedactionProtocol extends RedactionAdditionProtocolImpl {
  protected generatePlaceholder(type: EntityType): string {
    if (type === 'CREDIT_CARD') {
      return '<CREDIT_CARD_****>';  // Indicate partial
    }
    return `<${type}>`;
  }
}
```

### Multi-Layer Redaction

```typescript
// Apply multiple redaction strategies
const query = "My SSN is 123-45-6789, email is john@example.com";

// Layer 1: Redact PII
// "My SSN is <SSN>, email is <EMAIL>"

// Layer 2: Generalize for STYLE level
// "My SSN is <PERSONAL_ID>, email is <CONTACT_INFO>"

// Implementation
class MultiLayerRedactionProtocol {
  async redact(query: string, level: PrivacyLevel): Promise<RedactedQuery> {
    switch (level) {
      case 'LOGIC':
        return { query, metadata: {} };  // No redaction
      case 'STYLE':
        return this.redactStyle(query);  // Generalize
      case 'SECRET':
        return this.redactSecret(query);  // Full redaction
    }
  }
}
```

---

## Comparison with Other Approaches

### vs. Intent Vectors (ADR-004)

| Aspect | R-A Protocol | Intent Vectors |
|--------|--------------|----------------|
| **Privacy** | High (no data transmitted) | Very High (ε-DP) |
| **Quality** | Very High (preserves structure) | High (95%+) |
| **Complexity** | Low (simple redaction) | High (encoding/decoding) |
| **Cloud Support** | Works with any model | Requires fine-tuned models |
| **Use Case** | Most queries | Highly sensitive queries |

**Recommendation:** Use R-A Protocol by default, Intent Vectors for maximum privacy.

### vs. Homomorphic Encryption

| Aspect | R-A Protocol | Homomorphic Encryption |
|--------|--------------|------------------------|
| **Privacy** | High | Very High |
| **Performance** | Very Fast | Very Slow (1000x+) |
| **Complexity** | Low | Very High |
| **Maturity** | Mature | Emerging |

**Recommendation:** R-A Protocol is more practical for current systems.

---

## Consequences

### Positive Consequences

**1. Functional Privacy**
- Cloud never sees sensitive data
- GDPR/HIPAA compliant
- User sovereignty

**2. Preserved Capability**
- Cloud AI understands semantic meaning
- Type-preserving placeholders
- High quality responses

**3. Easy Implementation**
- Simple redaction/re-hydration
- Works with existing cloud APIs
- No model fine-tuning required

**4. Transparent**
- User sees what's redacted
- Can adjust redaction level
- Clear privacy guarantees

**5. Cost Efficient**
- Smaller queries (redaction reduces size)
- No special infrastructure
- No encryption overhead

**6. Regulatory Compliance**
- GDPR: No personal data transmitted
- HIPAA: No PHI transmitted
- SOC2: Data protection by design

### Negative Consequences

**1. Metadata Leakage**
- Placeholder types leak information
- "My SSN is <SSN>" tells cloud user has SSN
- May need additional layering

**2. Edge Cases**
- Complex queries may lose context
- Multiple redactions can make query awkward
- Hard to redact implicit information

**3. Storage**
- Need to store metadata locally
- Need to match responses to queries
- Stateful protocol

**4. Debugging**
- Harder to debug redacted queries
- Need to preserve original for logging
- Can't share redacted examples easily

### Neutral Consequences

**1. Client-Side Processing**
- Redaction happens on client
- Tradeoff: More client complexity vs. better privacy

**2. Type Preservation**
- Placeholders preserve entity types
- Tradeoff: Some leakage vs. better understanding

---

## Implementation Status

### Completed

- ✅ RedactionAdditionProtocol interface
- ✅ EntityRecognizer implementation
- ✅ Basic redaction/re-hydration logic
- ✅ Support for common entity types

### In Progress

- 🚧 Contextual redaction (ML-based)
- 🚧 Partial redaction (keep some context)
- 🚧 Multi-layer redaction (privacy levels)

### TODO (P1)

- 🔴 Better entity recognition (ML model)
- 🔴 Edge case handling
- 🔴 Performance optimization
- 🔴 Comprehensive testing

---

## Privacy Level Mapping

```typescript
// Map privacy levels to redaction strategies
const REDACTION_STRATEGIES = {
  LOGIC: {
    description: 'No redaction needed',
    redact: false,
    example: 'What is the capital of France?'
  },

  STYLE: {
    description: 'Generalize personal information',
    redact: true,
    generalize: true,
    example: 'I live in <CITY>'  // Instead of 'I live in San Francisco'
  },

  SECRET: {
    description: 'Full redaction of sensitive data',
    redact: true,
    generalize: false,
    example: 'My SSN is <SSN>'  // Full redaction
  }
};
```

---

## Examples

### Example 1: Financial Query

```typescript
const query = "My credit card 1234-5678-9012-3456 was charged $500";

// Redact
const { query: redacted, metadata } = await protocol.redact(query);
// "My credit card <CREDIT_CARD> was charged $500"

// Send to cloud
const response = await openaiClient.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: redacted }]
});

// Re-hydrate
const final = await protocol.rehydrate(response.choices[0].message.content, metadata);
// "Your credit card 1234-5678-9012-3456 shows a $500 charge from Merchant..."
```

### Example 2: Medical Query

```typescript
const query = "I have diabetes and my blood sugar is 200";

// Redact (medical information)
const { query: redacted, metadata } = await protocol.redact(query);
// "I have <MEDICAL_CONDITION> and my blood sugar is <MEASUREMENT>"

// Send to cloud
const response = await openaiClient.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: redacted }]
});

// Re-hydrate
const final = await protocol.rehydrate(response.choices[0].message.content, metadata);
// "For your diabetes, a blood sugar of 200 is considered high..."
```

### Example 3: Credentials

```typescript
const query = "My password is hunter2 and I forgot it";

// Redact (credential)
const { query: redacted, metadata } = await protocol.redact(query);
// "My password is <PASSWORD> and I forgot it"

// Send to cloud
const response = await openaiClient.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: redacted }]
});

// Re-hydrate
const final = await protocol.rehydrate(response.choices[0].message.content, metadata);
// "To reset your password hunter2, go to Settings > Security..."
```

---

## Security Considerations

### Threat Model

**Attacker: Cloud AI Provider**

*Goals:*
1. Extract sensitive data from queries
2. Reconstruct redacted information
3. Link queries to users

*Defenses:*
1. **No raw data transmitted** - Values never leave client
2. **Type-preserving placeholders** - Minimal information leakage
3. **Local storage only** - Metadata never transmitted
4. **Ephemeral metadata** - Deleted after re-hydration

### Limitations

**What R-A Protocol does NOT protect against:**
1. Inference from placeholder types (e.g., user has SSN)
2. Traffic analysis (query timing, size)
3. Response analysis (information in response)

**Mitigations:**
1. Combine with Intent Vectors (ADR-004) for maximum privacy
2. Add padding to normalize query sizes
3. Use differential privacy for metadata

---

## References

1. [Privacy-Preserving NLP](https://arxiv.org/abs/2301.00000) - Survey of techniques
2. [Named Entity Recognition](https://en.wikipedia.org/wiki/Named-entity_recognition) - NER fundamentals
3. [GDPR Compliance](https://gdpr.eu/) - Data protection regulation
4. [ADR-004](./004-intent-vectors-for-privacy.md) - Alternative privacy approach

---

## Related ADRs

- **ADR-001:** Protocol-First Design (PrivacyProtocol definition)
- **ADR-004:** Intent Vectors for Privacy (alternative/complementary)
- **ADR-002:** Three-Plane Separation (IntentionPlane privacy)

---

**Status:** Accepted
**Last Updated:** 2025-02-10
**Maintained by:** Aequor Core Team
