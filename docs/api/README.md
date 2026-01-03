# API Documentation

This directory contains automatically generated API documentation for the SuperInstance / Aequor Cognitive Orchestration Platform.

## About This Documentation

The API documentation is automatically generated from TypeScript source code using a **custom documentation generator** (`scripts/generate-docs.cjs`). It parses TypeScript files to extract exports, interfaces, classes, types, enums, functions, and constants, then generates organized Markdown documentation.

The generator extracts:
- Export statements (named and default)
- TSDoc comments (/** ... */)
- Type information
- File locations

## Packages Documented

The following packages are included in the API documentation:

- **@lsi/cascade** - Cascade routing system with complexity-based model selection
- **@lsi/core** - Core libcognitive API (transduce, recall, cogitate, effect)
- **@lsi/protocol** - Protocol definitions and interfaces (ATP/ACP)
- **@lsi/embeddings** - Text embedding services and vector operations
- **@lsi/privacy** - Privacy-preserving protocols (R-A Protocol, IntentEncoder)
- **@lsi/config** - Configuration management system
- **@lsi/swarm** - Distributed coordination and CRDTs
- **@lsi/utils** - Utility functions and helpers

## Regenerating Documentation

To regenerate the API documentation from source:

```bash
# From the demo directory
npm run docs:generate
```

This will:
1. Scan all configured packages for `src/index.ts` files
2. Parse TypeScript to find exports (classes, interfaces, types, enums, functions, constants)
3. Extract TSDoc comments for documentation
4. Generate organized Markdown files in `docs/api/`
5. Create an index with all packages and export counts

## Viewing Documentation Locally

To serve the documentation locally:

```bash
# Start a local web server
npm run docs:serve

# Or use any static file server
npx serve docs/api
```

Then open your browser to `http://localhost:3000` (or the port shown).

## Documentation Format

The documentation is generated in Markdown format with:

- **Type Information** - Class, interface, type, enum, function, or constant
- **Descriptions** - Extracted from TSDoc comments before exports
- **Export Type** - Named or default export
- **Source Links** - Direct file paths to source code

## Writing Documentation

To improve the generated documentation, add TSDoc comments to your source code:

```typescript
/**
 * Routes queries to appropriate models based on complexity.
 *
 * @remarks
 * The router uses a cascade strategy: try local models first,
 * escalate to cloud if complexity or confidence thresholds
 * are not met.
 *
 * @example
 * ```typescript
 * const router = new CascadeRouter();
 * const result = await router.route(query);
 * ```
 */
export class CascadeRouter {
  // ...
}
```

The generator will extract the comment before each export and include it in the documentation.

## Categories

Documentation is organized by type:
- **Classes** - TypeScript class definitions
- **Interfaces** - TypeScript interface definitions
- **Types** - TypeScript type aliases
- **Enums** - TypeScript enumerations
- **Functions** - Exported functions
- **Constants** - Exported constants (const/let/var)

## Exported Symbols

The documentation includes:
- Public classes and interfaces
- Type aliases and enums
- Exported functions
- Exported constants
- Both named and default exports

## Adding Packages

To add a new package to the documentation:

1. Edit `scripts/generate-docs.cjs`
2. Add the package path to the `PACKAGES_TO_DOC` array:

```javascript
const PACKAGES_TO_DOC = [
  'packages/cascade',
  'packages/your-new-package',  // Add here
  // ...
];
```

3. Run `npm run docs:generate`

## Automation

Consider adding documentation generation to your CI/CD pipeline:

```yaml
# .github/workflows/docs.yml
name: Generate API Documentation

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Generate documentation
        run: npm run docs:generate
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        if: github.ref == 'refs/heads/main'
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./docs/api
```

## Statistics

Current documentation coverage:
- **Total Packages:** 8
- **Total Exports:** 41
- **Documentation Pages:** 10 Markdown files

## Further Reading

- [TSDoc Reference](https://tsdoc.org/)
- [Main Project README](/README.md)
- [Architecture Documentation](/docs/ARCHITECTURE.md)
- [Project Status](/docs/STATUS.md)

---

**Generated:** 2026-01-02
**Tool:** Custom documentation generator (Node.js)
**Source:** TypeScript source code in `/packages/*/src/index.ts`
**Format:** Markdown
