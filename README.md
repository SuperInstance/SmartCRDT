# SuperInstance

**Modular infrastructure for AI applications**

```
superinstance pull router
superinstance app install chat-assistant
```

---

## What It Does

SuperInstance provides modular components for AI applications:

- **router** - Routes AI requests to appropriate models
- **cache** - Stores and retrieves AI responses
- **privacy** - Handles data privacy
- **embeddings** - Generates text embeddings
- **adapters** - Connects to AI models (OpenAI, Ollama, etc.)

Components can be pulled independently or installed as part of complete apps.

---

## Installation

```bash
npm install -g superinstance
```

---

## Quick Start

```bash
# Install a routing component
superinstance pull router

# Install a caching component
superinstance pull cache

# Install an app (includes multiple components)
superinstance app install chat-assistant

# Run an app
superinstance app run chat-assistant
```

---

## CLI Reference

### Components

```bash
superinstance pull <component>     # Pull component from registry
superinstance list                  # List available components
superinstance info <component>      # Show component details
superinstance update <component>    # Update component
superinstance remove <component>    # Remove component
```

### Apps

```bash
superinstance app install <app>     # Install app
superinstance app run <app>         # Run app
superinstance app list              # List apps
superinstance app info <app>        # Show app details
```

### Configuration

```bash
superinstance config get <key>      # Get config value
superinstance config set <key> <val> # Set config value
superinstance config list           # List all config
```

---

## Component System

Components are defined by manifests:

```yaml
name: router
version: 1.0.0
type: routing
description: Routes AI requests
dependencies:
  - protocol >= 1.0.0
```

The registry handles:
- Dependency resolution
- Version compatibility
- Hardware adaptation

---

## How It Works

1. **Pull** - Download components from registry
2. **Configure** - Set up component behavior
3. **Run** - Use components in your app
4. **Learn** - System adapts to usage patterns

SuperInstance learns from local usage. Each installation develops its own profile based on hardware, usage patterns, and performance.

---

## Hardware

Works on any hardware:
- x86_64 (Intel/AMD)
- ARM64 (Apple Silicon, Raspberry Pi)
- Minimal requirements: 1GB RAM

No GPU required.

---

## Development

```bash
git clone https://github.com/SuperInstance/SmartCRDT
cd SmartCRDT/demo
npm install
npm run build
npm test
```

---

## Documentation

See [CLAUDE.md](./CLAUDE.md) for comprehensive documentation.

---

## License

MIT

---

## Repository

https://github.com/SuperInstance/SmartCRDT
