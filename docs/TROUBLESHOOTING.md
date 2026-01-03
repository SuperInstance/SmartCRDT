# Troubleshooting Guide

**Aequor Cognitive Orchestration Platform - Troubleshooting Guide**

**Last Updated:** 2026-01-02
**Version:** 1.0.0

---

## Table of Contents

1. [Installation Issues](#1-installation-issues)
2. [Build Issues](#2-build-issues)
3. [Runtime Issues](#3-runtime-issues)
4. [Testing Issues](#4-testing-issues)
5. [Docker Issues](#5-docker-issues)
6. [Common Errors](#6-common-errors)
7. [Debugging Tips](#7-debugging-tips)
8. [Getting Help](#8-getting-help)

---

## 1. Installation Issues

### Node.js Version Conflicts

**Problem:** Package installation fails due to Node.js version mismatch.

**Error Messages:**
```
engines-not-supported: Expected node version ">=18.0.0" but found v16.x.x
```

**Solutions:**

#### Option 1: Use nvm (Recommended)

```bash
# Install Node.js 18 or later
nvm install 20
nvm use 20

# Verify version
node --version  # Should show v20.x.x or later
npm --version   # Should show 9.x.x or later
```

#### Option 2: Use n (macOS/Linux)

```bash
# Install latest LTS
sudo n lts

# Or install specific version
sudo n 20
```

#### Option 3: Download from Node.js Website

Visit https://nodejs.org/ and download the LTS version (18.x or later).

---

### npm Install Failures

**Problem:** Dependencies fail to install with various errors.

#### Error: EACCES Permission Denied

**Error Message:**
```
npm ERR! code EACCES
npm ERR! syscall open
npm ERR! path /usr/local/lib/node_modules/@lsi/protocol
npm ERR! errno -13
npm ERR! Error: EACCES: permission denied
```

**Solution:**

```bash
# Option 1: Fix npm permissions (Recommended)
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Option 2: Use Node Version Manager (nvm) instead of system Node
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
```

#### Error: Network Timeout

**Error Message:**
```
npm ERR! network timeout at: https://registry.npmjs.org/@lsi%2fprotocol
```

**Solution:**

```bash
# Increase timeout
npm install --timeout=180000

# Or use a mirror
npm install --registry=https://registry.npmmirror.com

# Or clear cache and retry
npm cache clean --force
npm install
```

#### Error: Peer Dependency Conflicts

**Error Message:**
```
npm ERR! peer dep missing: @lsi/protocol@^1.0.0, required by @lsi/cascade@1.0.0
```

**Solution:**

```bash
# Use legacy peer deps (temporary workaround)
npm install --legacy-peer-deps

# Or install with force (not recommended for production)
npm install --force

# Better solution: Fix workspace dependencies
npm workspaces update
```

---

### Rust Toolchain Issues

**Problem:** Native modules fail to build due to missing or outdated Rust toolchain.

**Error Messages:**
```
error: linker `link.exe` not found
  = note: the system cannot find the specified program
```

**Solutions:**

#### Install Rust Toolchain

```bash
# Install Rust using rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add to PATH (add to ~/.bashrc or ~/.zshrc)
source $HOME/.cargo/env

# Verify installation
rustc --version  # Should show 1.70.0 or later
cargo --version  # Should show 1.70.0 or later
```

#### Windows-Specific Issues

```bash
# Install C++ Build Tools (required for Rust on Windows)
# Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/

# Or install via chocolatey
choco install llvm
choco install make
```

#### Linux-Specific Issues

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install build-essential libssl-dev pkg-config

# Fedora/CentOS
sudo dnf groupinstall "C Development Tools and Libraries"
sudo dnf install openssl-devel
```

#### macOS-Specific Issues

```bash
# Install Xcode Command Line Tools
xcode-select --install

# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

---

### Permission Errors

**Problem:** Cannot install packages due to file system permissions.

**Error Message:**
```
Error: EPERM: operation not permitted, unlink '...node_modules/.package-lock.json'
```

**Solutions:**

```bash
# On Linux/macOS: Fix ownership
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) node_modules

# On Windows: Run terminal as Administrator

# Or clean and reinstall
npm run clean
rm -rf node_modules package-lock.json
npm install
```

---

## 2. Build Issues

### TypeScript Compilation Errors

**Problem:** TypeScript compiler reports errors during build.

#### Error: TS2307 - Cannot Find Module

**Error Message:**
```
src/index.ts:10:25 - error TS2307: Cannot find module '@lsi/protocol' or its corresponding type declarations
```

**Solution:**

```bash
# Check if protocol package is built
ls packages/protocol/dist

# If missing, build protocol first
cd packages/protocol
npm run build

# Build all packages in correct order
cd ../..
npm run build:ts

# If still failing, check tsconfig paths
cat packages/cascade/tsconfig.json | grep paths
```

**Verify tsconfig.json:**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@lsi/protocol": ["../protocol/src"],
      "@lsi/*": ["..//*/src"]
    }
  }
}
```

#### Error: TS2345 - Type Mismatch

**Error Message:**
```
error TS2345: Argument of type 'string' is not assignable to parameter of type 'QueryType'
```

**Solution:**

```bash
# Run TypeScript in strict mode to see all errors
npx tsc --noEmit --strict

# Fix type errors by importing correct types
import type { QueryType } from '@lsi/protocol';

// Or use type assertion (not recommended)
const queryType = 'question' as QueryType;
```

#### Error: TS5097 - Build Target Not Found

**Error Message:**
```
error TS5097: Cannot open file '/packages/cascade/tsconfig.json'
```

**Solution:**

```bash
# Check if tsconfig.json exists
ls packages/cascade/tsconfig.json

# Rebuild project references
npx tsc -b --clean
npx tsc -b

# Or rebuild specific package
npx tsc -b packages/cascade
```

---

### Module Resolution Failures

**Problem:** Build fails due to ES module resolution issues.

#### Error: ERR_MODULE_NOT_FOUND

**Error Message:**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/path/to/@lsi/protocol/src/index.ts'
```

**Solution:**

```bash
# Ensure package.json has "type": "module"
cat package.json | grep type

# Should output: "type": "module"

# Check imports use .js extension
# Even for .ts files, use .js in import
import { something } from './module.js';  // ✅ Correct
import { something } from './module';     // ❌ Wrong

# Rebuild after fixing imports
npm run build:ts
```

#### Error: Cannot Resolve Dependency

**Error Message:**
```
Cannot resolve dependency '@lsi/protocol@workspace:*'
```

**Solution:**

```bash
# Clean all node_modules
npm run clean:deep

# Reinstall dependencies
npm install

# Build protocol package first
npm run build --workspace=@lsi/protocol

# Then build dependent packages
npm run build --workspace=@lsi/cascade
```

---

### Native Module Compilation

**Problem:** Rust/C++ native modules fail to compile.

#### Error: cargo not found

**Error Message:**
```
sh: cargo: command not found
```

**Solution:**

```bash
# Install Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Rebuild native modules
npm run build:native
```

#### Error: link.exe not found (Windows)

**Solution:**

```bash
# Install Visual Studio Build Tools
# Download from: https://visualstudio.microsoft.com/downloads/

# Or install via chocolatey
choco install visualstudio2019buildtools
choco install visualstudio2019-workload-vctools

# Restart terminal and rebuild
npm run build:native
```

#### Error: Rust compiler panic

**Error Message:**
```
error: internal compiler error: cannot load `std` for target
```

**Solution:**

```bash
# Update Rust toolchain
rustup update stable
rustup default stable

# Clean Rust build artifacts
cd native
cargo clean

# Rebuild
npm run build:native
```

---

### Out of Memory Errors

**Problem:** Build process runs out of memory and crashes.

**Error Message:**
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**Solution:**

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=8192"

# On Windows (PowerShell)
$env:NODE_OPTIONS="--max-old-space-size=8192"

# Build with increased memory
NODE_OPTIONS="--max-old-space-size=8192" npm run build

# Or create .npmrc file
echo "max_old_space_size=8192" >> .npmrc
```

---

## 3. Runtime Issues

### Ollama Connection Failures

**Problem:** Cannot connect to Ollama service.

#### Error: ECONNREFUSED

**Error Message:**
```
OllamaAdapterError: Ollama service unreachable at http://localhost:11434. Is Ollama running?
```

**Solution:**

```bash
# Check if Ollama is running
ps aux | grep ollama

# Start Ollama service
ollama serve

# Check if port 11434 is listening
netstat -an | grep 11434
# Or on Windows:
netstat -an | findstr "11434"

# Test connection manually
curl http://localhost:11434/api/tags

# If Ollama not installed, install it:
curl https://ollama.ai/install.sh | sh
```

#### Error: Connection Timeout

**Error Message:**
```
OllamaAdapterError: Request timeout after 30000ms
```

**Solution:**

```bash
# Check Ollama logs
ollama logs

# Increase timeout in configuration
export OLLAMA_TIMEOUT=60000

# Or in code:
const adapter = new OllamaAdapter(
  'http://localhost:11434',
  'llama2',
  { timeout: 60000 }
);

# Restart Ollama if it's stuck
pkill ollama
ollama serve
```

#### Error: Model Not Found

**Error Message:**
```
OllamaAdapterError: Model not found: llama2
```

**Solution:**

```bash
# List available models
ollama list

# Pull missing model
ollama pull llama2

# Or use a different model
ollama pull qwen2.5:3b

# Update configuration
export OLLAMA_MODEL=qwen2.5:3b
```

---

### OpenAI API Errors

**Problem:** OpenAI API requests failing.

#### Error: Authentication Failed

**Error Message:**
```
Error: 401 { error: { message: 'Incorrect API key provided', type: 'invalid_request_error' } }
```

**Solution:**

```bash
# Check if API key is set
echo $OPENAI_API_KEY

# Set API key
export OPENAI_API_KEY=sk-...

# Or create .env file
echo "OPENAI_API_KEY=sk-..." > .env

# Verify API key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

#### Error: Rate Limit Exceeded

**Error Message:**
```
Error: 429 { error: { message: 'Rate limit exceeded', type: 'rate_limit_error' } }
```

**Solution:**

```bash
# Implement exponential backoff
npm install @nestjs/throttler

# Or reduce request frequency
# In code:
const adapter = new OpenAIAdapter(apiKey, {
  maxRetries: 5,
  retryDelay: 1000,
});

# Check rate limit status
curl https://api.openai.com/v1/rate_limits \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

#### Error: Insufficient Quota

**Error Message:**
```
Error: 'You exceeded your current quota'
```

**Solution:**

```bash
# Check billing status
# Visit: https://platform.openai.com/account/billing

# Set usage limits
# Visit: https://platform.openai.com/account/limits

# Add payment method or upgrade plan
```

---

### Cache Not Working

**Problem:** Semantic cache not returning hits.

#### Debug: Check Cache Statistics

```typescript
import { SemanticCache } from '@lsi/cascade';

const cache = new SemanticCache();

// Perform some queries
await cache.set('query 1', result1);
const result2 = await cache.get('query 2');

// Get cache stats
const stats = cache.getStats();
console.log(stats);
// { hits: 0, misses: 2, hitRate: 0.0 }
```

#### Solution: Fix Low Hit Rate

```bash
# Check threshold configuration
# Threshold too high = fewer hits
# Threshold too low = false positives

# Adjust threshold
const cache = new SemanticCache({
  threshold: 0.85  // Default is 0.85
});

# Enable debug logging
export LSI_LOG_LEVEL=debug

# Clear cache if corrupted
rm -rf data/cache/*
```

#### Error: HNSW Index Not Found

**Error Message:**
```
Error: HNSW native module not found
```

**Solution:**

```bash
# Check if native modules are built
ls native/embeddings/dist/*.node

# Rebuild native modules
npm run build:native:release

# Verify native module loading
node -e "require('@lsi/cascade/native'); console.log('OK')"

# If still failing, fall back to TypeScript implementation
export LSI_USE_NATIVE=false
```

---

### Performance Problems

**Problem:** Slow query response times.

#### Debug: Profile Performance

```bash
# Run benchmarks
npm run bench

# Generate performance report
npm run bench:report

# Check results
cat docs/PERFORMANCE_REPORT.md
```

#### Solution: Optimize Configuration

```typescript
// Enable native modules (3-30x faster)
import { SemanticCacheNative } from '@lsi/cascade';
const cache = new SemanticCacheNative();

// Increase cache size
const cache = new SemanticCache({
  maxSize: 10000,  // Default is 1000
  maxAge: 3600000  // 1 hour
});

// Adjust HNSW index parameters
const index = new HNSWIndex({
  M: 16,        // Number of neighbors (default: 16)
  ef: 200,      // Search depth (default: 200)
  efConstruction: 200  // Build depth (default: 200)
});
```

#### Solution: Use Native Modules

```bash
# Build native modules in release mode
npm run build:native:release

# Verify performance improvement
npm run bench

# Expected: 3-30x speedup
```

---

## 4. Testing Issues

### Tests Timing Out

**Problem:** Tests fail due to timeout.

**Error Message:**
```
Error: Test timeout of 5000ms exceeded
```

**Solution:**

```bash
# Increase timeout in vitest config
# Edit vitest.config.ts:
export default defineConfig({
  test: {
    testTimeout: 10000,
    hookTimeout: 10000,
  }
});

# Or increase for specific test
import { describe, it } from 'vitest';

it('slow test', async () => {
  // ... test code
}, { timeout: 30000 });
```

---

### Mock Failures

**Problem:** Mocks not working correctly.

**Error Message:**
```
Error: Cannot spy the property because it is not a function
```

**Solution:**

```typescript
// Use vi.mock from Vitest
import { vi, describe, it, expect } from 'vitest';
import { OllamaAdapter } from '@lsi/cascade';

// Mock at top level
vi.mock('@lsi/cascade', () => ({
  OllamaAdapter: vi.fn()
}));

// Or mock specific method
const adapter = new OllamaAdapter();
vi.spyOn(adapter, 'execute').mockResolvedValue({
  content: 'mocked response'
});

// Clear mocks after test
afterEach(() => {
  vi.clearAllMocks();
});
```

---

### Coverage Not Generating

**Problem:** Coverage reports not created.

**Solution:**

```bash
# Install coverage provider
npm install --save-dev @vitest/coverage-v8

# Run tests with coverage
npm run test:coverage

# Check if c8 or v8 is installed
npm list @vitest/coverage-v8

# Generate HTML report
npx vitest run --coverage --reporter=html
```

---

### Vitest Configuration Issues

**Problem:** Vitest cannot find test files.

**Solution:**

```bash
# Check vitest.config.ts
cat vitest.config.ts

# Verify include/exclude patterns
# Should include:
export default defineConfig({
  test: {
    include: ['packages/**/*.test.ts', 'tests/**/*.ts'],
    exclude: ['node_modules', 'dist', 'build']
  }
});

# Run specific test file
npx vitest run packages/cascade/src/router/CascadeRouter.test.ts

# Check file naming
# Test files must end with .test.ts or .spec.ts
```

---

## 5. Docker Issues

### Container Won't Start

**Problem:** Docker containers fail to start.

#### Error: Port Already in Use

**Error Message:**
```
Error: bind: address already in use
```

**Solution:**

```bash
# Check what's using the port
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :11434 # Ollama

# Stop conflicting service
sudo systemctl stop postgresql
# Or
docker ps | grep 5432
docker stop <container_id>

# Or change port in docker-compose.yml
ports:
  - "5433:5432"  # Use 5433 instead
```

#### Error: Image Build Failed

**Error Message:**
```
ERROR [builder] failed to solve
```

**Solution:**

```bash
# Clean Docker cache
docker system prune -a

# Rebuild image
docker-compose build --no-cache

# Check Dockerfile syntax
cat Dockerfile

# Check for syntax errors or missing dependencies
```

---

### Volume Mounting Problems

**Problem:** Docker volumes not mounting correctly.

**Error Message:**
```
Error: Mounts denied: The path /path/to/source is not shared from OS X
```

**Solution:**

```bash
# On macOS: Enable file sharing in Docker Desktop
# Settings > Resources > File Sharing > Add path

# On Linux: Check permissions
ls -ld /path/to/source
sudo chown -R $USER:$USER /path/to/source

# Check volume mount in docker-compose.yml
volumes:
  - ./packages:/app/packages:rw  # Must be absolute or relative path
  - /absolute/path:/app/data:rw
```

---

### Network Issues

**Problem:** Containers cannot communicate.

**Solution:**

```bash
# Check network configuration
docker network ls
docker network inspect smartcrdt_lsi-network

# Ensure all services on same network
# In docker-compose.yml, all services should have:
networks:
  - lsi-network

# Test connectivity between containers
docker exec lsi-postgres ping lsi-redis

# Check firewall rules
sudo ufw status
# Allow Docker ports if blocked
```

---

### Resource Limits

**Problem:** Containers crash due to resource constraints.

**Solution:**

```bash
# Check container resource usage
docker stats

# Increase limits in docker-compose.yml
services:
  lsi:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G

# On Docker Desktop: Increase resources
# Settings > Resources > Memory > Increase to 8GB+
```

---

## 6. Common Errors

### "Cannot find module '@lsi/protocol'"

**Error Message:**
```
Error: Cannot find module '@lsi/protocol'
```

**Solution:**

```bash
# Check if protocol package exists
ls packages/protocol

# Build protocol package
cd packages/protocol
npm run build

# Install dependencies
npm install

# Check package.json exports
cat packages/protocol/package.json | grep exports

# Should have:
# "exports": {
#   ".": "./src/index.ts"
# }

# Rebuild project
cd ../..
npm run build:ts
```

---

### "HNSW native module not found"

**Error Message:**
```
Error: HNSW native module not found
Error: Cannot find module '@lsi/cascade/native'
```

**Solution:**

```bash
# Check if native module exists
ls native/embeddings/dist/*.node

# If missing, build native modules
npm run build:native

# If Rust not installed, install it
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Rebuild native modules
npm run build:native:release

# If still failing, use TypeScript fallback
export LSI_USE_NATIVE=false
```

---

### "Ollama connection refused"

**Error Message:**
```
OllamaAdapterError: Ollama service unreachable at http://localhost:11434
```

**Solution:**

```bash
# Start Ollama service
ollama serve

# In another terminal, test connection
curl http://localhost:11434/api/tags

# Pull a model
ollama pull llama2

# Test inference
ollama run llama2 "Hello, world"

# If Ollama not installed, install it:
curl https://ollama.ai/install.sh | sh
```

---

### "Cache miss rate too high"

**Problem:** Cache hit rate below 80%.

**Solution:**

```bash
# Check cache statistics
# Add logging to your code:
console.log(cache.getStats());

# Adjust threshold
const cache = new SemanticCache({
  threshold: 0.80  // Lower than default 0.85
});

# Enable adaptive threshold
const cache = new SemanticCache({
  adaptiveThreshold: {
    enabled: true,
    initialThreshold: 0.85,
    measurementWindow: 100
  }
});

# Clear stale cache entries
cache.clear();
await cache.warmup([commonQueries]);
```

---

## 7. Debugging Tips

### Enable Debug Logging

**Environment Variables:**

```bash
# Enable debug logging
export LSI_LOG_LEVEL=debug

# Enable trace logging (very verbose)
export LSI_LOG_LEVEL=trace

# Log to file
export LSI_LOG_FILE=/tmp/lsi-debug.log

# Enable specific module logging
export DEBUG=lsi:*,lsi:router,lsi:cache
```

**In Code:**

```typescript
import { createLogger } from '@lsi/utils';

const logger = createLogger('my-module');
logger.setLevel('debug');
logger.debug('Debug message', { data: 'value' });
```

---

### Use TypeScript Debugger

**VS Code:**

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "program": "${workspaceFolder}/node_modules/.bin/vitest",
      "args": ["run", "${file}"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug TypeScript File",
      "runtimeArgs": ["-r", "ts-node/register"],
      "args": ["${file}"],
      "console": "integratedTerminal"
    }
  ]
}
```

**Chrome DevTools:**

```bash
# Run with inspect flag
node --inspect-brk packages/cascade/src/index.ts

# Open chrome://inspect in Chrome
# Click "Inspect" to open DevTools
```

---

### Profile Performance

**CPU Profiling:**

```bash
# Run with profiler
node --prof packages/cascade/src/index.ts

# Process profile
node --prof-process isolate-*.log > profile.txt

# View profile
cat profile.txt
```

**Memory Profiling:**

```bash
# Run with heap profiler
node --heap-prof packages/cascade/src/index.ts

# Generate heap snapshot
node --heap-prof -name profile.heapsnapshot

# Visualize with Chrome DevTools
# Load profile.heapsnapshot in Memory tab
```

**Flame Graphs:**

```bash
# Install clinic.js
npm install -g clinic

# Generate flamegraph
clinic flame -- node packages/cascade/src/index.ts

# Open HTML report
# flamegraph.html opens in browser
```

---

### Analyze Bundle Size

**Webpack Bundle Analyzer:**

```bash
# Install
npm install --save-dev webpack-bundle-analyzer

# Analyze bundle
npx webpack --profile --json > stats.json
npx webpack-bundle-analyzer stats.json

# Opens browser with bundle visualization
```

**Source Map Explorer:**

```bash
# Install
npm install --save-dev source-map-explorer

# Build with source maps
npm run build -- --source-map

# Analyze
npx source-map-explorer dist/**/*.js
```

---

## 8. Getting Help

### GitHub Issues

**Before Creating an Issue:**

1. Search existing issues: https://github.com/SuperInstance/SmartCRDT/issues
2. Check documentation: https://github.com/SuperInstance/SmartCRDT/blob/main/README.md
3. Try troubleshooting steps above

**When Creating an Issue:**

Include:
- **Environment:** OS, Node.js version, npm version
- **Steps to reproduce:** Minimal reproduction case
- **Expected behavior:** What should happen
- **Actual behavior:** What actually happens
- **Error messages:** Full error stack traces
- **Logs:** Debug logs (set `LSI_LOG_LEVEL=debug`)

**Template:**

```markdown
## Description
Brief description of the issue

## Environment
- OS: Ubuntu 22.04
- Node.js: v20.10.0
- npm: 10.2.3
- Aequor: 1.0.0

## Steps to Reproduce
1. Run `npm install`
2. Run `npm run build`
3. Error occurs

## Expected Behavior
Build succeeds

## Actual Behavior
Build fails with error

## Error Message
```
Error: Cannot find module '@lsi/protocol'
```

## Logs
```
LSI_LOG_LEVEL=debug npm run build
[debug] Loading configuration...
[debug] Building packages...
```
```

---

### Discord/Slack Community

**Join the community:**
- Discord: https://discord.gg/aequor
- Slack: https://aequor-dev.slack.com

**Before asking:**
1. Read channel topics and pinned messages
2. Search channel history
3. Be respectful and patient

**When asking:**
- Describe what you're trying to do
- Share what you've already tried
- Include error messages
- Use code blocks for code/errors

---

### Stack Overflow

**Tag your questions:**
- `aequor`
- `lsi-protocol`
- `semantic-cache`
- `ollama`

**Good questions:**
- Specific and reproducible
- Include code examples
- Show what you've tried
- Explain expected vs actual

---

### Support Email

**For commercial support:**
- Email: support@aequor.dev
- Response time: 1-2 business days
- Include "Support Request" in subject line

---

## Additional Resources

### Documentation

- [Architecture Decisions](/mnt/c/users/casey/smartCRDT/demo/docs/adr/)
- [API Documentation](/mnt/c/users/casey/smartCRDT/demo/docs/api/)
- [Project Roadmap](/mnt/c/users/casey/smartCRDT/demo/docs/ROADMAP.md)

### Examples

- [Basic Usage](/mnt/c/users/casey/smartCRDT/demo/examples/basic/)
- [Advanced Patterns](/mnt/c/users/casey/smartCRDT/demo/examples/advanced/)
- [Integration Examples](/mnt/c/users/casey/smartCRDT/demo/examples/integrations/)

### Tools

- [CLI Reference](/mnt/c/users/casey/smartCRDT/demo/packages/cli/README.md)
- [Benchmarking Guide](/mnt/c/users/casey/smartCRDT/demo/benchmarks/README.md)
- [Testing Guide](/mnt/c/users/casey/smartCRDT/demo/tests/README.md)

---

## Quick Reference

### Common Commands

```bash
# Clean build
npm run clean && npm install && npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Start Docker services
docker-compose up -d

# Check Ollama status
curl http://localhost:11434/api/tags

# View logs
journalctl -u ollama -f
docker-compose logs -f

# Debug mode
LSI_LOG_LEVEL=debug npm start

# Profile performance
npm run bench

# Lint code
npm run lint

# Format code
npm run format
```

### Environment Variables

```bash
# API Keys
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...

# Ollama
export OLLAMA_BASE_URL=http://localhost:11434
export OLLAMA_MODEL=llama2

# Logging
export LSI_LOG_LEVEL=debug
export LSI_LOG_FILE=/tmp/lsi.log

# Performance
export NODE_OPTIONS="--max-old-space-size=8192"
export LSI_USE_NATIVE=true
```

### Common File Locations

```
/mnt/c/users/casey/smartCRDT/demo/
├── packages/           # Source code
│   ├── protocol/       # Protocol definitions
│   ├── cascade/        # Router and cache
│   └── superinstance/  # Main instance
├── docs/               # Documentation
├── tests/              # Test files
├── docker-compose.yml  # Docker configuration
├── tsconfig.json       # TypeScript config
└── vitest.config.ts    # Test configuration
```

---

**Need more help?** Check the [GitHub Issues](https://github.com/SuperInstance/SmartCRDT/issues) or join our [Discord community](https://discord.gg/aequor).
