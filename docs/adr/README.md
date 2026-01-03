# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) for the Aequor Cognitive Orchestration Platform. ADRs document key architectural decisions, their context, and consequences.

## What is an ADR?

An Architecture Decision Record (ADR) is a document that describes an important architectural decision, the context surrounding it, and the consequences of adopting it. ADRs:

- Provide historical context for decisions
- Help new contributors understand the architecture
- Enable learning from past decisions
- Document the "why" behind design choices

## Format

Our ADRs follow the standard format from [adr.github.io](https://adr.github.io/):

1. **Title** - Clear, descriptive title
2. **Status** - Accepted, Deprecated, Superseded, etc.
3. **Context** - Problem being solved
4. **Decision** - Solution chosen
5. **Consequences** - Positive, negative, and neutral outcomes
6. **Examples** - Code samples and usage
7. **References** - Related resources

## ADR Index

### Core Architecture

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [001-protocol-first-design.md](./001-protocol-first-design.md) | Protocol-First Design | Accepted | 2025-01-15 |
| [002-three-plane-separation.md](./002-three-plane-separation.md) | Three-Plane Separation | Accepted | 2025-01-20 |

### Routing and Inference

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [003-cascade-routing.md](./003-cascade-routing.md) | Cascade Routing | Accepted | 2025-01-25 |

### Privacy and Security

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [004-intent-vectors-for-privacy.md](./004-intent-vectors-for-privacy.md) | Intent Vectors for Privacy | Accepted | 2025-02-01 |
| [006-redaction-addition-protocol.md](./006-redaction-addition-protocol.md) | Redaction-Addition Protocol | Accepted | 2025-02-10 |

### Data Storage

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [005-crdt-for-knowledge.md](./005-crdt-for-knowledge.md) | CRDT for Knowledge Storage | Accepted | 2025-02-05 |

## Quick Reference

### By Topic

**Architecture & Design**
- ADR-001: Protocol-First Design
- ADR-002: Three-Plane Separation

**Routing**
- ADR-003: Cascade Routing

**Privacy**
- ADR-004: Intent Vectors for Privacy
- ADR-006: Redaction-Addition Protocol

**Data Management**
- ADR-005: CRDT for Knowledge Storage

### By Status

**Accepted (6)**
- All current ADRs are accepted and in use

**Proposed (0)**
- No ADRs currently proposed

**Deprecated (0)**
- No ADRs have been deprecated

**Superseded (0)**
- No ADRs have been superseded

## Creating New ADRs

When making a significant architectural decision:

1. **Check existing ADRs** - Ensure decision hasn't been documented
2. **Use the template** - Follow the standard format
3. **Number sequentially** - Next ADR is 007
4. **Get review** - Discuss with team before accepting
5. **Update this index** - Add to the table above

### ADR Template

```markdown
# ADR XXX: [Title]

**Status:** [Accepted/Proposed/Deprecated/Superseded]
**Date:** YYYY-MM-DD
**Deciders:** [Team/Individual]
**Related:** [Links to related ADRs]

---

## Context

[Describe the problem or situation that led to this decision]

### Current State

[Describe the current state and why it's insufficient]

## Decision

[Describe the decision made]

### Technical Details

[Provide technical specifications, code examples, diagrams]

## Consequences

### Positive Consequences
- [List benefits]

### Negative Consequences
- [List drawbacks]

### Neutral Consequences
- [List trade-offs]

## Examples

[Provide concrete examples of the decision in action]

## References

[Link to relevant resources, research, standards]

## Related ADRs

- [ADR-XXX](./xxx-name.md) - [Relationship]

---

**Status:** [Status]
**Last Updated:** YYYY-MM-DD
**Maintained by:** [Team]
```

## ADR Lifecycle

```
┌─────────────┐
│  Proposed   │  Draft stage, gathering feedback
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Accepted   │  Decision made, implementation in progress
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Deprecated  │  Decision reversed or no longer relevant
└─────────────┘

       │
       ▼
┌─────────────┐
│ Superseded  │  Replaced by new ADR (link to new ADR)
└─────────────┘
```

## Key Decisions Summary

### Protocol-First Design (ADR-001)
- **What:** Define all interfaces in @lsi/protocol before implementing
- **Why:** Enable ecosystem, version stability, clear contracts
- **Impact:** All packages depend on protocol definitions

### Three-Plane Separation (ADR-002)
- **What:** Split SuperInstance into Context, Intention, LucidDreamer
- **Why:** Clear boundaries, independent evolution, progressive adoption
- **Impact:** Architecture is now modular and testable

### Cascade Routing (ADR-003)
- **What:** Route queries based on complexity and emotional intelligence
- **Why:** 90% cost reduction, 60% latency improvement
- **Impact:** Most queries processed locally

### Intent Vectors for Privacy (ADR-004)
- **What:** Encode queries as 768-dim vectors before cloud transmission
- **Why:** Privacy with ε-differential privacy guarantees
- **Impact:** Sensitive queries can use cloud AI safely

### CRDT for Knowledge (ADR-005)
- **What:** Use CRDTs for distributed knowledge storage
- **Why:** Offline-first, multi-device, automatic conflict resolution
- **Impact:** Knowledge syncs seamlessly across devices

### Redaction-Addition Protocol (ADR-006)
- **What:** Redact locally, send structural query, re-hydrate response
- **Why:** Functional privacy without sacrificing capability
- **Impact:** Sensitive data never transmitted to cloud

## Related Documentation

- [Architecture Decisions](../ARCHITECTURE_DECISIONS.md) - Design rationale
- [Implementation Roadmap](../ROADMAP.md) - Technical roadmap
- [Project Status](../STATUS.md) - Current implementation status
- [CLAUDE.md](../../CLAUDE.md) - Project guide for AI agents

## Resources

- [ADR GitHub](https://adr.github.io/) - ADR format specification
- [Markdown Guide](https://www.markdownguide.org/) - Markdown syntax
- [Diagrams](https://mermaid-js.github.io/) - Diagram syntax (used in ADRs)

---

**Last Updated:** 2025-02-10
**Total ADRs:** 6
**Maintained by:** Aequor Core Team
