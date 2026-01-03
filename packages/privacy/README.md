# @lsi/privacy

> **Privacy-preserving AI inference with functional guarantees**

Advanced privacy suite for the Aequor Cognitive Orchestration Platform. Transform how your AI applications handle sensitive data with cryptographically sound privacy guarantees, differential privacy, and secure computation protocols.

## Features

### Core Privacy Capabilities

- **Intent Encoding with ε-Differential Privacy** - Transform queries into 768-dimensional vectors with provable privacy guarantees
- **Redaction-Addition Protocol (R-A Protocol)** - Functional privacy that preserves query structure while removing sensitive data
- **Privacy Classification** - Categorize queries as LOGIC/STYLE/SECRET with ML-based classification
- **PII Detection** - Identify and redact personally identifiable information (emails, SSNs, credit cards, phone numbers, addresses)
- **Privacy Firewall** - Rule-based middleware for enforcing privacy policies at inference time
- **Audit Logging** - Complete audit trail for compliance with GDPR, HIPAA, and SOC 2

### Advanced Cryptographic Primitives

- **Partially Homomorphic Encryption (PHE)** - Compute on encrypted embeddings without revealing the underlying data
- **Zero-Knowledge Proofs (ZKP)** - Verify computations without revealing inputs (range proofs, set membership, routing proofs)
- **Secure VM (WASM Sandbox)** - Execute untrusted code in isolated environments with resource limits
- **Byzantine Ensemble** - Fault-tolerant multi-model inference with robust voting mechanisms

### Privacy-Preserving Machine Learning

- **Differential Privacy for ML** - Train models with privacy guarantees using gradient noise injection
- **Privacy Budget Tracking** - Manage privacy loss over time with RDP and ZCDP accountants
- **Private Gradient Descent** - Optimized training with clipping and noise calibration

### Security Monitoring

- **Behavioral Profiling** - Detect anomalous access patterns and potential privacy violations
- **Security Event Correlation** - Identify attack patterns like lateral movement and data exfiltration
- **Real-time Monitoring** - Continuous surveillance of privacy events with alerting

## Installation

```bash
npm install @lsi/privacy
```

## Quick Start

### Intent Encoding with Differential Privacy

Encode queries into privacy-preserving intent vectors:

```typescript
import { IntentEncoder } from '@lsi/privacy';

// Initialize encoder with ε-differential privacy
const encoder = new IntentEncoder({
  openaiKey: process.env.OPENAI_API_KEY,
  epsilon: 1.0  // Balanced privacy/utility (recommended)
});

await encoder.initialize();

// Encode a query - sensitive data is protected by ε-DP
const intent = await encoder.encode("My SSN is 123-45-6789, what's my credit score?");

console.log(intent.vector);     // Float32Array(768) - privacy-preserving embedding
console.log(intent.epsilon);    // 1.0 - privacy guarantee
console.log(intent.confidence); // 0.95 - encoding confidence

// Intent vectors can be safely sent to cloud services
// without revealing sensitive information
```

### Redaction-Addition Protocol

Remove sensitive data while preserving query structure:

```typescript
import { RedactionAdditionProtocol } from '@lsi/privacy';

// Initialize R-A Protocol
const rap = new RedactionAdditionProtocol({
  enableRedaction: true,
  redactTypes: [
    PIIType.EMAIL,
    PIIType.PHONE,
    PIIType.SSN,
    PIIType.CREDIT_CARD,
    PIIType.ADDRESS
  ],
  preserveFormat: true,
  redactionToken: "[REDACTED]"
});

// Redact sensitive data locally
const result = await rap.redact(
  "My email is john@example.com and my phone is 555-1234"
);

console.log(result.redactedQuery);
// "My email is [REDACTED] and my phone is [REDACTED]"

console.log(result.context.redactions);
// Map { '[PII_0]': 'john@example.com', '[PII_1]': '555-1234' }

// Send redacted query to cloud
const cloudResponse = await cloudModel.query(result.redactedQuery);

// Re-hydrate response with original data
const finalResponse = rap.rehydrate(cloudResponse, result.context);
```

### Privacy Classification

Classify query privacy level before processing:

```typescript
import { PrivacyClassifier, PrivacyLevel } from '@lsi/privacy';

const classifier = new PrivacyClassifier();

const classification = await classifier.classify(
  "What is the password for the admin account?"
);

console.log(classification.level);
// PrivacyLevel.SECRET - Requires maximum protection

console.log(classification.category);
// PrivacyCategory.CREDENTIALS - Contains credential data

// Route based on classification
if (classification.level === PrivacyLevel.SECRET) {
  // Process locally only, never send to cloud
  return await localModel.process(query);
} else if (classification.level === PrivacyLevel.SENSITIVE) {
  // Apply R-A Protocol before cloud inference
  const redacted = await rap.redact(query);
  return await cloudModel.process(redacted.redactedQuery);
} else {
  // Safe to send directly to cloud
  return await cloudModel.process(query);
}
```

### Privacy Firewall

Enforce privacy policies with rule-based middleware:

```typescript
import { PrivacyFirewall, PrivacyLevel } from '@lsi/privacy';

const firewall = new PrivacyFirewall({
  rules: [
    {
      id: 'block-sovereign-cloud',
      priority: 100,
      condition: {
        privacyLevel: PrivacyLevel.SOVEREIGN
      },
      action: 'deny',
      reason: 'SOVEREIGN data cannot leave local environment'
    },
    {
      id: 'redact-sensitive-cloud',
      priority: 90,
      condition: {
        privacyLevel: PrivacyLevel.SENSITIVE,
        destination: 'cloud'
      },
      action: 'redact',
      reason: 'SENSITIVE data must be redacted before cloud inference'
    }
  ]
});

const decision = await firewall.evaluate({
  query: "My SSN is 123-45-6789",
  privacyLevel: PrivacyLevel.SENSITIVE,
  destination: 'cloud'
});

if (decision.action === 'deny') {
  throw new Error(decision.reason);
} else if (decision.action === 'redact') {
  query = await rap.redact(query);
}
```

### Zero-Knowledge Proofs

Verify computations without revealing inputs:

```typescript
import { generateRangeProof, verifyRangeProof } from '@lsi/privacy';

// Prove that a user's age is within a range without revealing the exact age
const proof = await generateRangeProof({
  claim: { type: 'age', min: 18, max: 65 },
  privateInput: { value: 31 },
  publicInput: { userId: 'user-123' }
});

// Verify the proof without learning the actual age
const isValid = await verifyRangeProof(proof);
console.log(isValid); // true - age is between 18-65, but we don't know it's 31
```

### Partially Homomorphic Encryption

Compute on encrypted embeddings:

```typescript
import { PHEIntentEncoder } from '@lsi/privacy';

const encoder = new PHEIntentEncoder({
  keySize: 2048,
  precision: 32
});

// Generate encryption keys
await encoder.initialize();

// Encrypt an intent vector
const encrypted = await encoder.encodeEncrypt("What is my account balance?");

// Compute similarity on encrypted data without decryption
const similarity = await encryptedEuclideanDistance(
  encrypted.embedding,
  otherEncryptedEmbedding
);

// Only the private key holder can decrypt the result
```

## Core Components

### IntentEncoder

Privacy-preserving intent encoding with ε-differential privacy.

**Pipeline:**
1. Embedding Generation (OpenAI text-embedding-3-small, 1536 dims)
2. Dimensionality Reduction (PCA: 1536 → 768 dims)
3. Differential Privacy (Gaussian mechanism with ε-DP)
4. L2 Normalization

**Privacy Guarantee:**
Satisfies ε-differential privacy: for any two neighboring queries, the probability distributions of their encoded vectors are within a factor of exp(ε).

### RedactionAdditionProtocol

Functional privacy through local redaction and re-hydration.

**Workflow:**
1. Detect and classify PII in query
2. Redact sensitive data locally
3. Send structural query to cloud
4. Re-hydrate response with original data

**Supported PII Types:**
- EMAIL (john@example.com)
- PHONE (555-1234)
- SSN (123-45-6789)
- CREDIT_CARD (4111-1111-1111-1111)
- ADDRESS (123 Main St, City, State)

### PrivacyClassifier

ML-based privacy classification with three levels:

**Privacy Levels:**
- **LOGIC** - Safe to share, no sensitive data
- **STYLE** - Personal writing style, requires redaction
- **SECRET** - Credentials, secrets, maximum protection

**Privacy Categories:**
- CREDENTIALS (passwords, API keys)
- FINANCIAL (account numbers, transactions)
- HEALTH (medical information)
- IDENTITY (SSN, passport numbers)
- CONTACT (email, phone, address)

### PrivacyFirewall

Rule-based middleware for privacy enforcement.

**Actions:**
- `allow` - Permit the request
- `deny` - Block the request
- `redact` - Apply R-A Protocol
- `redirect` - Route to different destination

**Default Rules:**
1. SOVEREIGN → deny (blocked from cloud)
2. SENSITIVE + cloud → redact
3. SECRET + cloud → deny

## Privacy Guarantees

### ε-Differential Privacy

The IntentEncoder satisfies ε-differential privacy, which provides the following guarantee:

For any two queries that differ by one element, and for any subset S of the output space:

```
Pr[M(q1) ∈ S] ≤ exp(ε) × Pr[M(q2) ∈ S]
```

Where:
- `M` is the encoding mechanism
- `q1` and `q2` are neighboring queries
- `ε` is the privacy parameter

### ε Value Selection

| ε Value | Privacy | Utility | Use Case |
|---------|---------|---------|----------|
| 0.1     | Strong  | Low     | Health records, financial data |
| 0.5     | Moderate| Medium  | Personal queries with PII |
| 1.0     | Balanced| Balanced| General-purpose (recommended) |
| 2.0     | Weak    | High    | Non-sensitive analytical queries |
| 5.0     | Very Weak| Very High| Public data, analytics |

### Threat Model

**Protected Against:**
- Reconstruction attacks on intent vectors
- Membership inference attacks
- Attribute inference attacks
- Model inversion attacks

**Assumptions:**
- Cloud provider is honest-but-curious
- Adversary has access to encoded queries
- Adversary does not have access to local data
- Cryptographic primitives are correctly implemented

### Limitations

- **Traffic Analysis**: Query timing and size may leak information
- **Side Channels**: CPU/cache attacks may leak data (mitigated by constant-time implementations)
- **Model Poisoning**: Malicious updates can degrade privacy (mitigated by validation)
- **Strong Adversaries**: Nation-state actors with unlimited resources may break assumptions

## Configuration

### IntentEncoder Configuration

```typescript
const encoder = new IntentEncoder({
  openaiKey: string;           // OpenAI API key (required)
  epsilon?: number;            // Privacy parameter (default: 1.0)
  model?: string;              // Embedding model (default: 'text-embedding-3-small')
  dimensions?: number;         // Output dimensions (default: 768)
  pcaMatrixPath?: string;      // Path to PCA matrix (optional)
});
```

### RedactionAdditionProtocol Configuration

```typescript
const rap = new RedactionAdditionProtocol({
  enableRedaction?: boolean;   // Enable redaction (default: true)
  redactTypes?: PIIType[];     // PII types to redact (default: all)
  preserveFormat?: boolean;    // Preserve format (default: true)
  redactionToken?: string;     // Redaction token (default: '[REDACTED]')
});
```

### PrivacyFirewall Configuration

```typescript
const firewall = new PrivacyFirewall({
  rules?: FirewallRule[];      // Custom rules (optional)
  defaultAction?: 'allow' | 'deny';  // Default action (default: 'deny')
  enableLogging?: boolean;     // Enable audit logging (default: true)
});
```

### PHE Configuration

```typescript
const encoder = new PHEIntentEncoder({
  keySize?: 2048 | 3072 | 4096;  // Key size (default: 2048)
  precision?: number;            // Fixed-point precision (default: 32)
  keyStorage?: KeyStorageBackend; // Key storage (default: in-memory)
});
```

## Security Considerations

### Best Practices

1. **Key Management**
   - Store private keys in secure enclaves (HSM, TPM)
   - Rotate keys regularly (recommended: 90 days)
   - Never log private keys or export them unencrypted

2. **Parameter Selection**
   - Use ε ≤ 1.0 for sensitive data
   - Use ε ≥ 2.0 only for non-sensitive analytics
   - Adjust privacy budget based on sensitivity

3. **Audit Logging**
   - Enable comprehensive audit logging for compliance
   - Protect audit logs against tampering
   - Regularly review logs for anomalies

4. **Defense in Depth**
   - Combine multiple privacy techniques (ε-DP + PHE + ZKP)
   - Use PrivacyFirewall as a safety net
   - Monitor for privacy violations with anomaly detection

### Adversarial Robustness

The privacy suite includes several mechanisms to resist adversarial attacks:

- **Behavioral Profiling** - Detect anomalous access patterns
- **Security Event Correlation** - Identify coordinated attacks
- **Secure VM** - Isolate untrusted code execution
- **Byzantine Ensemble** - Tolerate faulty or malicious models

## License

MIT

---

## Contributing

Contributions are welcome! Please see the [Aequor CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## Support

For questions, issues, or contributions, please visit the [Aequor GitHub repository](https://github.com/SuperInstance/SmartCRDT).

---

**Part of the Aequor Cognitive Orchestration Platform**

Privacy is not an afterthought — it's a first-class guarantee.
