# Contributing to Aequor / SmartCRDT

Thank you for your interest in contributing to Aequor! We appreciate your help in building a universal AI orchestration platform that treats AI requests as constraint satisfaction problems.

This guide will help you get started with contributing to the project. Whether you're fixing a bug, implementing a new feature, or improving documentation, we welcome your contributions.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation Standards](#documentation-standards)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Reporting Issues](#reporting-issues)
- [License](#license)

---

## Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. Please:

- Be respectful and constructive
- Welcome newcomers and help them learn
- Focus on what is best for the community
- Show empathy towards other community members

If you encounter any issues, please contact the maintainers.

---

## Getting Started

### Prerequisites

Before you begin contributing, ensure you have the following installed:

**Required:**
- **Node.js** >= 18.0.0 ([Download](https://nodejs.org/))
- **npm** >= 9.0.0 (comes with Node.js)
- **Git** ([Download](https://git-scm.com/))

**Optional (for native modules):**
- **Rust** toolchain (for performance-critical modules)
- **Docker** (for running PostgreSQL, Redis, ChromaDB)

### Forking and Cloning

1. Fork the repository on GitHub
2. Clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/SmartCRDT.git
cd SmartCRDT/demo
```

3. Add the upstream remote:

```bash
git remote add upstream https://github.com/SuperInstance/SmartCRDT.git
```

### Installation

1. Install dependencies:

```bash
npm install
```

2. Build all packages:

```bash
npm run build
```

3. Run tests to verify your setup:

```bash
npm test
```

### Verification

You're ready to contribute when:

```bash
# All packages build successfully
npm run build

# All tests pass
npm test

# Linter passes
npm run lint
```

---

## Development Workflow

We follow a standard Git workflow with feature branches.

### 1. Create a Feature Branch

Always create a new branch for your work. Never work directly on `main`.

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

**Branch Naming Conventions:**
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions or changes
- `perf/` - Performance improvements

### 2. Make Your Changes

Develop your feature or fix following our [Coding Standards](#coding-standards).

### 3. Run Tests and Linters

Before committing, ensure:

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linter
npm run lint

# Format code
npm run format
```

### 4. Commit Your Changes

Use [Conventional Commits](#commit-messages) format:

```bash
git add .
git commit -m "feat: add new routing algorithm"
```

### 5. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a pull request on GitHub following our [PR Process](#pull-request-process).

### 6. Keep Your Branch Updated

Periodically sync with upstream:

```bash
git fetch upstream
git rebase upstream/main
```

---

## Project Structure

Aequor is a **monorepo** using npm workspaces with multiple packages.

### Repository Layout

```
demo/
├── packages/                    # All packages
│   ├── protocol/               # Protocol definitions (types, interfaces)
│   ├── core/                   # Core libcognitive API
│   ├── cascade/                # Cascade router + query analysis
│   ├── superinstance/          # SuperInstance (Context, Intention, LucidDreamer)
│   ├── privacy/                # Privacy suite (encryption, R-A Protocol)
│   ├── swarm/                  # CRDT and distributed state
│   ├── cli/                    # Command-line interface
│   ├── embeddings/             # Embedding services
│   └── ...                     # Other packages
├── tests/                      # Cross-package integration tests
│   ├── unit/
│   └── e2e/
├── docs/                       # Project documentation
├── scripts/                    # Build and utility scripts
├── .github/                    # GitHub workflows, templates, etc.
├── package.json                # Root package.json
├── tsconfig.json               # Root TypeScript config
├── .eslintrc.js                # ESLint configuration
├── .prettierrc                 # Prettier configuration
└── CLAUDE.md                   # AI agent project guide
```

### Package Dependencies

The dependency hierarchy is:

```
@lsi/protocol          # Base types - no dependencies
    ↓
@lsi/core              # Core API - depends on protocol
    ↓
@lsi/cascade           # Router - depends on protocol, core
    ↓
@lsi/superinstance     # Main platform - depends on all above
    ↓
@lsi/privacy           # Privacy suite - depends on protocol
@lsi/swarm             # CRDT store - depends on protocol
```

**Key Rule:** Never create circular dependencies. Always depend on lower-level packages.

### Finding Things

| What You Want | Where It Is |
|---------------|-------------|
| Protocol types | `packages/protocol/src/index.ts` |
| Cascade router | `packages/cascade/src/router/CascadeRouter.ts` |
| Intent router | `packages/cascade/src/router/IntentRouter.ts` |
| Privacy layer | `packages/privacy/src/protocol/RedactionAdditionProtocol.ts` |
| CRDT store | `packages/swarm/src/crdt/CRDTStore.ts` |
| Context plane | `packages/superinstance/src/context/ContextPlane.ts` |
| Intention plane | `packages/superinstance/src/intention/IntentionPlane.ts` |
| LucidDreamer | `packages/superinstance/src/luciddreamer/LucidDreamer.ts` |

---

## Coding Standards

### TypeScript Style Guide

We use **TypeScript** with strict type checking throughout the project.

**General Rules:**

1. **Use strict TypeScript** - Enable all strict checks
2. **Avoid `any`** - Use `unknown` if type is truly unknown
3. **Explicit types on exports** - Public APIs must have explicit types
4. **Prefer `interface` for public APIs** - Use `type` for unions/intersections
5. **Use `readonly`** - Mark immutable properties as readonly
6. **Prefer `const` assertions** - Use `as const` for literal types

```typescript
// ✅ Good
interface User {
  readonly id: string;
  readonly name: string;
  email: string;
}

const config = {
  endpoint: 'https://api.example.com',
  timeout: 5000,
} as const;

// ❌ Bad
const user: any = {};
const data = user.data; // No type safety
```

### Naming Conventions

Follow these naming conventions:

| Category | Convention | Example |
|----------|------------|---------|
| **Files** | PascalCase for classes/components | `CascadeRouter.ts` |
| **Files** | camelCase for utilities | `stringUtils.ts` |
| **Classes** | PascalCase | `class SemanticCache {}` |
| **Interfaces** | PascalCase, no `I` prefix | `interface Query {}` |
| **Types** | PascalCase | `type Embedding = number[];` |
| **Constants** | UPPER_SNAKE_CASE | `const MAX_RETRIES = 3;` |
| **Functions/Methods** | camelCase | `function calculateScore() {}` |
| **Private properties** | camelCase with `_` prefix | `private _cache: Map;` |
| **Enums** | PascalCase | `enum LogLevel {}` |

### File Organization

Organize files by feature, not by type:

```
src/
├── router/
│   ├── CascadeRouter.ts
│   ├── IntentRouter.ts
│   └── index.ts
├── cache/
│   ├── SemanticCache.ts
│   ├── CacheEntry.ts
│   └── index.ts
└── utils/
    ├── embeddings.ts
    └── strings.ts
```

**Barrel exports (index.ts):** Re-export public APIs

```typescript
// router/index.ts
export { CascadeRouter } from './CascadeRouter';
export { IntentRouter } from './IntentRouter';
```

### Code Organization

Within a file, organize in this order:

1. File header comment
2. Imports (grouped: stdlib, external, internal)
3. Type definitions
4. Constants
5. Class/function implementations
6. Exports

```typescript
/**
 * CascadeRouter implements complexity-based routing for AI queries.
 *
 * @packageDocumentation
 */

// Stdlib
import { performance } from 'node:perf_hooks';

// External
import { OpenAI } from 'openai';

// Internal
import type { Query, RoutingDecision } from '@lsi/protocol';

// Types
interface RouterConfig {
  readonly maxRetries: number;
  readonly timeout: number;
}

// Constants
const DEFAULT_TIMEOUT = 5000;

// Implementation
export class CascadeRouter {
  // ...
}
```

### JSDoc Requirements

**Required for:**
- All exported functions and methods
- All exported classes and interfaces
- Complex types

```typescript
/**
 * Routes a query to the appropriate model based on complexity analysis.
 *
 * @param query - The query to route
 * @param context - Optional context for routing decisions
 * @returns Promise resolving to routing decision
 * @throws {RoutingError} When routing fails after max retries
 *
 * @example
 * ```typescript
 * const router = new CascadeRouter();
 * const decision = await router.route(query);
 * if (decision.useLocal) {
 *   // Handle locally
 * }
 * ```
 */
async route(
  query: Query,
  context?: RoutingContext
): Promise<RoutingDecision> {
  // Implementation
}
```

### ESLint Configuration

We use ESLint with TypeScript support. Configuration in `.eslintrc.js`:

```javascript
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
  ],
  rules: {
    'no-console': 'warn',
    '@typescript-eslint/no-unused-vars': 'error',
    'prefer-const': 'error',
  },
};
```

### Prettier Configuration

We use Prettier for consistent formatting. Configuration in `.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 80,
  "arrowParens": "avoid",
  "endOfLine": "lf"
}
```

**Before committing, run:**

```bash
npm run format
```

---

## Testing Guidelines

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run unit tests only
npm run test:unit

# Run end-to-end tests
npm run test:e2e

# Test specific package
cd packages/cascade && npm test

# Test specific file
npx vitest run packages/cascade/src/router/CascadeRouter.test.ts
```

### Writing Tests

We use **Vitest** as our test runner (compatible with Jest).

**Test File Location:**

```
packages/cascade/src/router/
├── CascadeRouter.ts
└── CascadeRouter.test.ts    # Test file next to implementation
```

**Test Structure:**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { CascadeRouter } from './CascadeRouter';

describe('CascadeRouter', () => {
  let router: CascadeRouter;

  beforeEach(() => {
    router = new CascadeRouter();
  });

  describe('route()', () => {
    it('should route simple queries locally', async () => {
      const query = createSimpleQuery();
      const decision = await router.route(query);

      expect(decision.useLocal).toBe(true);
      expect(decision.model).toBe('local');
    });

    it('should route complex queries to cloud', async () => {
      const query = createComplexQuery();
      const decision = await router.route(query);

      expect(decision.useLocal).toBe(false);
      expect(decision.model).toContain('gpt');
    });

    it('should throw error for invalid query', async () => {
      const query = createInvalidQuery();

      await expect(router.route(query)).rejects.toThrow();
    });
  });
});
```

### Test Categories

1. **Unit Tests** - Test individual functions/classes in isolation
2. **Integration Tests** - Test interactions between components
3. **E2E Tests** - Test full workflows from input to output

### Coverage Requirements

| Metric | Target | Current |
|--------|--------|---------|
| Overall Coverage | 80% | ~60% |
| Critical Path Coverage | 95% | ~75% |
| New Code Coverage | 90% | Required |

### Best Practices

1. **Test behavior, not implementation** - Focus on what, not how
2. **Use descriptive test names** - Should read like documentation
3. **Arrange-Act-Assert** - Structure tests clearly
4. **Mock external dependencies** - Use vi.mock for external services
5. **Test edge cases** - Don't just test happy path
6. **Keep tests fast** - Use unit tests for speed, E2E for verification

```typescript
// ✅ Good: Tests behavior
it('returns cached result when available', async () => {
  const result = await cache.get('key');
  expect(result).toBeDefined();
});

// ❌ Bad: Tests implementation
it('calls cache._internalGet()', async () => {
  const spy = vi.spyOn(cache, '_internalGet');
  await cache.get('key');
  expect(spy).toHaveBeenCalled();
});
```

---

## Documentation Standards

### JSDoc Comments

All public APIs must have JSDoc comments:

```typescript
/**
 * Calculates semantic similarity between two embeddings.
 *
 * @param embedding1 - First embedding vector (768-dimensional)
 * @param embedding2 - Second embedding vector (768-dimensional)
 * @returns Similarity score between 0 and 1, where 1 is identical
 * @throws {ValidationError} If embeddings are not 768-dimensional
 *
 * @example
 * ```typescript
 * const similarity = calculateSimilarity(embeddingA, embeddingB);
 * console.log(`Similarity: ${similarity.toFixed(2)}`);
 * ```
 */
function calculateSimilarity(
  embedding1: number[],
  embedding2: number[]
): number {
  // Implementation
}
```

### README Files

Each package should have a README.md with:

1. **Purpose** - What does this package do?
2. **Installation** - How to install
3. **Usage** - Basic usage examples
4. **API** - Main classes/functions
5. **Examples** - More detailed examples
6. **Contributing** - Link to main CONTRIBUTING.md

```markdown
# @lsi/cascade

Cascade routing for cost-optimized AI queries.

## Installation

\`\`\`bash
npm install @lsi/cascade
\`\`\`

## Usage

\`\`\`typescript
import { CascadeRouter } from '@lsi/cascade';

const router = new CascadeRouter();
const decision = await router.route(query);
\`\`\`

## API

### CascadeRouter

Main router class.

#### Methods

- \`route(query)\` - Route a query
- \`setThreshold(threshold)\` - Set complexity threshold

## Examples

See \`examples/\` directory for complete examples.
```

### API Documentation

Generate API docs with:

```bash
npm run docs:generate
npm run docs:serve
```

### Inline Comments

Use inline comments sparingly. Code should be self-documenting:

```typescript
// ✅ Good: Self-documenting code
const userAge = calculateAge(user.birthDate);

// ❌ Bad: Unnecessary comment
// Calculate user's age from birth date
const age = calculateAge(user.birthDate);

// ✅ Good: Comment explains WHY
// Use exponential backoff to avoid overwhelming the server
const delay = Math.pow(2, attemptCount) * BASE_DELAY;
```

---

## Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat: add new routing algorithm` |
| `fix` | Bug fix | `fix: resolve race condition in cache` |
| `docs` | Documentation | `docs: update README with new examples` |
| `style` | Formatting, missing semicolons | `style: format code with prettier` |
| `refactor` | Code refactoring | `refactor: simplify cache implementation` |
| `perf` | Performance improvement | `perf: optimize vector similarity calculation` |
| `test` | Adding or updating tests | `test: add tests for CascadeRouter` |
| `build` | Build system or dependencies | `build: upgrade to TypeScript 5.3` |
| `ci` | CI/CD changes | `ci: add GitHub Actions workflow` |
| `chore` | Other changes | `chore: update .gitignore` |

### Scopes

Common scopes:

- `protocol` - Protocol definitions
- `cascade` - Cascade router
- `superinstance` - SuperInstance platform
- `privacy` - Privacy suite
- `swarm` - CRDT and distributed state
- `cli` - Command-line interface
- `docs` - Documentation
- `tests` - Test infrastructure

### Examples

```bash
# Simple commit
git commit -m "feat: add intent-based routing"

# With scope
git commit -m "feat(cascade): implement complexity scoring"

# With body
git commit -m "fix(router): resolve memory leak in cache

The cache was not properly evicting old entries, causing
memory to grow unbounded over time.

Fixes #123"
```

### Best Practices

1. **Use imperative mood** - "add" not "added" or "adds"
2. **Keep subject line short** - Max 50 characters
3. **Capitalize subject** - "Add feature" not "add feature"
4. **Don't end with period** - Subject line should not end with `.`
5. **Reference issues** - Use `Fixes #123` or `Closes #456`
6. **Explain WHAT and WHY** - Not HOW

```bash
# ✅ Good
git commit -m "feat: add semantic caching for queries
This reduces API costs by caching similar queries with 80% hit rate."

# ❌ Bad
git commit -m "added caching feature"
git commit -m "fix bug"
git commit -m "update"
```

---

## Pull Request Process

### Before Creating a PR

1. **Update your branch** with latest main
2. **Ensure all tests pass** - `npm test`
3. **Run linter** - `npm run lint`
4. **Format code** - `npm run format`
5. **Update documentation** - If API changes

### Creating the PR

1. Go to GitHub and click "New Pull Request"
2. Choose your branch
3. Fill in the PR template

### PR Title

Follow conventional commit format:

```
feat: add new routing algorithm
fix: resolve race condition in cache
docs: update README with new examples
```

### PR Description

Use the PR template to describe:

- **What** does this PR do?
- **Why** is it needed?
- **How** does it work?
- **Testing** - How did you test?
- **Breaking changes** - Are there any?

### PR Checklist

Before requesting review, ensure:

- [ ] Tests pass locally (`npm test`)
- [ ] Linter passes (`npm run lint`)
- [ ] Code is formatted (`npm run format`)
- [ ] Documentation updated (if needed)
- [ ] Commit messages follow convention
- [ ] PR description is complete
- [ ] Linked to relevant issue (e.g., "Fixes #123")

### Review Process

1. **Automated checks** must pass (CI, tests, linter)
2. **Code review** by maintainers (minimum 1 approval)
3. **Address feedback** - Make requested changes
4. **Approval** - Maintainer approves
5. **Merge** - Maintainer merges (squash and merge)

### Review Guidelines

For reviewers:

- **Be constructive** - Focus on code, not person
- **Explain reasoning** - Help contributor learn
- **Approve with changes** - If minor issues exist
- **Request changes** - If major issues exist
- **Be timely** - Review within 48 hours

### Merge Requirements

- [ ] All CI checks pass
- [ ] At least 1 maintainer approval
- [ ] No merge conflicts
- [ ] Documentation updated (if needed)
- [ ] Tests added/updated (if needed)

### After Merge

- Delete your branch
- Update local main
- Celebrate! You've contributed to Aequor!

---

## Reporting Issues

### Bug Reports

Use the bug report template on GitHub:

```markdown
**Description**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

**Expected Behavior**
A clear description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Environment**
- OS: [e.g. Ubuntu 22.04]
- Node version: [e.g. 18.17.0]
- Package version: [e.g. 1.0.0]

**Additional Context**
Add any other context about the problem here.
```

### Feature Requests

Use the feature request template:

```markdown
**Problem Statement**
What problem does this feature solve? What are you trying to achieve?

**Proposed Solution**
How would you like this feature to work? Provide examples if possible.

**Alternatives**
Describe alternatives you've considered.

**Additional Context**
Add any other context or screenshots about the feature request here.
```

### Before Reporting

1. **Search existing issues** - Don't create duplicates
2. **Check if it's a question** - Use Discussions for questions
3. **Include minimal repro** - Help us reproduce the issue
4. **Provide environment info** - OS, Node version, package version

---

## License

By contributing to Aequor, you agree that your contributions will be licensed under the **MIT License**.

### MIT License Summary

- ✅ Free to use in commercial and personal projects
- ✅ Free to modify and distribute
- ✅ No warranty or liability
- ✅ Keep copyright and license notice

### Contributor License Agreement (CLA)

Currently, we do NOT require a separate CLA. By contributing, you implicitly agree to the MIT license terms.

### Copyright Notice

When adding new files, include:

```typescript
/**
 * @license MIT
 *
 * Copyright (c) 2025 Aequor Contributors
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction...
 */
```

---

## Getting Help

### Resources

- **Documentation** - `/demo/docs/`
- **Project Guide** - `CLAUDE.md`
- **Architecture** - `ARCHITECTURE_DECISIONS.md`
- **Roadmap** - `PROJECT_ROADMAP.md`

### Communication

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - Questions and ideas
- **Pull Requests** - Code contributions

### Maintainers

For urgent issues, contact maintainers via GitHub @mentions in the issue or PR.

---

## Thank You!

Thank you for taking the time to contribute to Aequor! Your contributions help make AI orchestration universal, sovereign, economic, and transparent.

**Every contribution matters**, whether it's:

- A bug fix
- A new feature
- Documentation improvement
- Test coverage
- Code review
- Answering questions

Together, we're building the "network router for AI" - invisible infrastructure that optimally routes every request while respecting privacy, budget, and hardware constraints.

**Let's build the future of AI orchestration together!**

---

**Last Updated:** 2026-01-02
**Version:** 1.0.0
