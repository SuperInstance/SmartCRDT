# SuperInstance CLI

**Modular AI Infrastructure - Command-Line Interface**

The SuperInstance CLI is the primary interface for managing AI components and applications. Pull components from the registry, install apps, and manage your AI infrastructure with simple commands.

## Installation

### Global Installation

```bash
npm install -g @lsi/cli
```

This installs the `superinstance` command globally on your system.

### Using npx (No Installation)

```bash
npx @lsi/cli <command>
```

### Development Installation

```bash
cd /path/to/smartCRDT/demo/packages/cli
npm link
```

## Quick Start

```bash
# Pull a routing component
superinstance pull router

# Install the chat assistant app
superinstance app pull chat-assistant

# Run the app
superinstance app run chat-assistant

# Check system status
superinstance status
```

## Commands

### Component Management

#### `pull` - Download and Install Components

```bash
superinstance pull <component> [options]
```

Pull a component from the registry and install it locally.

**Examples:**

```bash
# Pull router component
superinstance pull router

# Pull specific version
superinstance pull router --version 1.2.0

# Pull multiple components
superinstance pull router cache embeddings

# Pull all dependencies
superinstance pull router --with-deps

# Dry run (preview without installing)
superinstance pull router --dry-run
```

**Options:**

- `-v, --version <version>` - Specify version to install
- `-f, --force` - Force reinstall even if already installed
- `--with-deps` - Automatically install dependencies
- `--dry-run` - Preview without making changes
- `--debug` - Show detailed output

#### `list` - List Available Components

```bash
superinstance list [options]
```

**Examples:**

```bash
# List all available components
superinstance list

# List only installed components
superinstance list --installed

# List components with updates available
superinstance list --updates

# List components by type
superinstance list --type routing
superinstance list --type cache
```

**Options:**

- `--installed` - Show only installed components
- `--updates` - Show components with available updates
- `--type <type>` - Filter by component type
- `--json` - Output as JSON

#### `info` - Show Component Details

```bash
superinstance info <component>
```

Display detailed information about a component.

**Examples:**

```bash
# Show component information
superinstance info router

# Verify component installation
superinstance info router --verify
```

#### `run` - Run a Component

```bash
superinstance run <component> [args...]
```

Execute a component directly.

**Examples:**

```bash
# Run router component
superinstance run router

# Run with custom configuration
superinstance run router --config ./my-config.yaml

# Run in interactive mode
superinstance run router --interactive

# Run as background service
superinstance run router --service
```

#### `update` - Update Components

```bash
superinstance update <component> [options]
```

Update a component to the latest version.

**Examples:**

```bash
# Update to latest version
superinstance update router

# Update to specific version
superinstance update router --version 2.0.0

# Check for updates without installing
superinstance update router --check

# Rollback to previous version
superinstance update router --rollback
```

#### `remove` - Remove Components

```bash
superinstance remove <component> [options]
```

Remove an installed component.

**Examples:**

```bash
# Remove component
superinstance remove router

# Force removal (ignore dependencies)
superinstance remove router --force

# Remove and clean configuration
superinstance remove router --purge
```

### Application Management

#### `app pull` - Install Applications

```bash
superinstance app pull <app> [options]
```

Pull and install an application with all its dependencies.

**Examples:**

```bash
# Install chat assistant app
superinstance app pull chat-assistant

# Install from custom registry
superinstance app pull chat-assistant --registry https://my-registry.com

# Install specific version
superinstance app pull chat-assistant --version 1.0.0
```

#### `app run` - Run Applications

```bash
superinstance app run <app> [args...]
```

Execute an installed application.

**Examples:**

```bash
# Run chat assistant
superinstance app run chat-assistant

# Run with environment variables
superinstance app run chat-assistant --env API_KEY=xxx

# Run in development mode
superinstance app run chat-assistant --dev
```

#### `app list` - List Applications

```bash
superinstance app list [options]
```

**Examples:**

```bash
# List all available apps
superinstance app list

# List installed apps only
superinstance app list --installed
```

#### `app stop` - Stop Running Applications

```bash
superinstance app stop <app>
```

Stop a running application.

**Examples:**

```bash
# Stop chat assistant
superinstance app stop chat-assistant

# Force stop
superinstance app stop chat-assistant --force
```

#### `app status` - Check Application Status

```bash
superinstance app status <app>
```

Display the current status of an application.

**Examples:**

```bash
# Check if app is running
superinstance app status chat-assistant

# Show detailed metrics
superinstance app status chat-assistant --verbose
```

#### `app remove` - Remove Applications

```bash
superinstance app remove <app> [options]
```

Remove an installed application.

**Examples:**

```bash
# Remove app
superinstance app remove chat-assistant

# Remove and clean all data
superinstance app remove chat-assistant --purge
```

### Configuration Management

#### `config get` - Get Configuration Value

```bash
superinstance config get <key>
```

Retrieve a configuration value.

**Examples:**

```bash
# Get cache enabled status
superinstance config get cache.enabled

# Get privacy epsilon value
superinstance config get privacy.epsilon

# Get nested value
superinstance config get router.defaultModel
```

#### `config set` - Set Configuration Value

```bash
superinstance config set <key> <value>
```

Set a configuration value.

**Examples:**

```bash
# Enable caching
superinstance config set cache.enabled true

# Set privacy epsilon
superinstance config set privacy.epsilon 1.0

# Set default model
superinstance config set router.defaultModel gpt-4

# Set array value
superinstance config set router.models '["gpt-4","gpt-3.5"]'
```

#### `config list` - List All Configuration

```bash
superinstance config list [options]
```

Display all configuration values.

**Examples:**

```bash
# List all configuration
superinstance config list

# Output as JSON
superinstance config list --json

# Show only specific section
superinstance config list --section cache
```

#### `config edit` - Edit Configuration File

```bash
superinstance config edit
```

Open the configuration file in your default editor.

### System Commands

#### `status` - System Status

```bash
superinstance status [options]
```

Display overall system status and health.

**Examples:**

```bash
# Show system status
superinstance status

# Show component details
superinstance status --components

# Show performance metrics
superinstance status --metrics

# Show everything
superinstance status --verbose
```

#### `query` - Run Query

```bash
superinstance query "<query>" [options]
```

Execute a query through the router.

**Examples:**

```bash
# Simple query
superinstance query "What is 2+2?"

# With routing trace
superinstance query "Explain quantum computing" --trace

# Use specific model
superinstance query "How do I sort an array?" --model gpt-4

# Streaming output
superinstance query "Tell me a story" --stream
```

#### `chat` - Interactive Chat

```bash
superinstance chat [options]
```

Start an interactive chat session.

**Examples:**

```bash
# Start chat
superinstance chat

# Use specific model
superinstance chat --model gpt-4

# With conversation history
superinstance chat --history ./history.json
```

### Utility Commands

#### `cache` - Cache Management

```bash
superinstance cache <command> [options]
```

**Subcommands:**

- `stats` - Show cache statistics
- `clear` - Clear cache
- `warm` - Warm cache with common queries

**Examples:**

```bash
# Show cache statistics
superinstance cache stats

# Clear cache
superinstance cache clear

# Warm cache
superinstance cache warm
```

#### `privacy` - Privacy Analysis

```bash
superinstance privacy "<query>" [options]
```

Analyze query for privacy concerns.

**Examples:**

```bash
# Analyze privacy
superinstance privacy "My email is test@example.com"

# Show classification details
superinstance privacy "My email is test@example.com" --classify --detailed
```

#### `export` - Export Data

```bash
superinstance export [options]
```

Export system data.

**Examples:**

```bash
# Export all data
superinstance export -o backup.json

# Export only knowledge
superinstance export -o knowledge.json -w knowledge

# Export as cartridge
superinstance export -o my-data.cartridge -f cartridge

# Compress export
superinstance export -o export.json -c
```

#### `import` - Import Data

```bash
superinstance import <file> [options]
```

Import system data.

**Examples:**

```bash
# Import all data
superinstance import backup.json

# Import only knowledge
superinstance import knowledge.json -t knowledge

# Replace existing data
superinstance import backup.json -m replace

# Validate before import
superinstance import backup.json --validate

# Preview import
superinstance import backup.json --dry-run
```

## Configuration File

The CLI uses a configuration file located at:

```
~/.superinstance/config.yaml
```

### Example Configuration

```yaml
# Cache Configuration
cache:
  enabled: true
  maxEntries: 1000
  ttl: 3600
  persistent: true

# Privacy Configuration
privacy:
  epsilon: 1.0
  enabled: true

# Router Configuration
router:
  defaultModel: gpt-3.5-turbo
  complexityThreshold: 0.7
  confidenceThreshold: 0.6

# Model Configuration
models:
  - name: gpt-4
    type: cloud
    provider: openai
  - name: llama2
    type: local
    provider: ollama

# Logging Configuration
logging:
  level: info
  file: ~/.superinstance/logs/superinstance.log
```

## Environment Variables

You can override configuration using environment variables:

```bash
# Set API key
export SUPERINSTANCE_API_KEY="your-api-key"

# Set cache directory
export SUPERINSTANCE_CACHE_DIR="/path/to/cache"

# Set registry URL
export SUPERINSTANCE_REGISTRY="https://registry.example.com"

# Enable debug mode
export SUPERINSTANCE_DEBUG="true"
```

## Examples

### Basic Workflow

```bash
# 1. Pull required components
superinstance pull router
superinstance pull cache
superinstance pull embeddings

# 2. Configure the system
superinstance config set cache.enabled true
superinstance config set privacy.epsilon 1.0

# 3. Run a query
superinstance query "What is SuperInstance?"

# 4. Check cache performance
superinstance cache stats
```

### Application Workflow

```bash
# 1. Install an app
superinstance app pull chat-assistant

# 2. Run the app
superinstance app run chat-assistant

# 3. Check status
superinstance app status chat-assistant

# 4. Stop when done
superinstance app stop chat-assistant
```

### Development Workflow

```bash
# 1. Pull components with dependencies
superinstance pull router --with-deps

# 2. Run component in development mode
superinstance run router --dev --debug

# 3. Test configuration changes
superinstance config set cache.enabled false

# 4. Verify component
superinstance info router --verify
```

### Privacy Workflow

```bash
# 1. Analyze query privacy
superinstance privacy "My SSN is 123-45-6789"

# 2. Enable privacy features
superinstance config set privacy.enabled true

# 3. Run query with privacy protection
superinstance query "My SSN is 123-45-6789" --privacy

# 4. Export anonymized data
superinstance export -o safe-data.json --anonymize
```

## Troubleshooting

### Common Issues

#### Command Not Found

If you get `command not found: superinstance`:

```bash
# Check if package is installed globally
npm list -g @lsi/cli

# Reinstall globally
npm install -g @lsi/cli

# Or use npx without installation
npx @lsi/cli <command>
```

#### Permission Denied

If you get permission errors:

```bash
# Fix npm permissions
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH

# Then reinstall
npm install -g @lsi/cli
```

#### Component Not Found

If a component isn't found:

```bash
# Update component registry
superinstance list --refresh

# Check registry URL
superinstance config get registry.url

# Try with full registry path
superinstance pull @lsi/router
```

#### Configuration Issues

If configuration is causing problems:

```bash
# Reset to default configuration
superinstance config reset

# Validate configuration
superinstance config validate

# Edit configuration directly
superinstance config edit
```

#### Cache Issues

If cache is causing problems:

```bash
# Clear cache
superinstance cache clear

# Disable cache temporarily
superinstance config set cache.enabled false

# Rebuild cache
superinstance cache warm
```

### Debug Mode

Enable debug mode for detailed output:

```bash
# Enable debug for single command
superinstance pull router --debug

# Enable globally
superinstance config set logging.level debug
```

### Getting Help

```bash
# Show general help
superinstance --help

# Show command help
superinstance pull --help
superinstance app run --help

# Show examples
superinstance examples

# Quick start guide
superinstance quickstart
```

## Advanced Usage

### Shell Completions

The CLI provides shell completions for bash, zsh, and fish:

```bash
# Install completions
superinstance completion install

# Generate completion script
superinstance completion script bash > ~/.superinstance/completion.bash
```

### Alias Configuration

Create command aliases in your shell configuration:

```bash
# In ~/.bashrc or ~/.zshrc
alias si='superinstance'
alias si-pull='superinstance pull'
alias si-run='superinstance app run'
alias si-status='superinstance status'
```

### scripting

Use the CLI in scripts:

```bash
#!/bin/bash
# Deploy script

# Pull components
superinstance pull router cache embeddings --quiet

# Configure system
superinstance config set cache.enabled true
superinstance config set router.defaultModel gpt-4

# Deploy app
superinstance app pull chat-assistant
superinstance app run chat-assistant --service
```

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## License

MIT License - see LICENSE file for details

## Support

- **Documentation:** [https://docs.superinstance.ai](https://docs.superinstance.ai)
- **Issues:** [GitHub Issues](https://github.com/SuperInstance/smartCRDT/issues)
- **Discord:** [Join our Discord](https://discord.gg/superinstance)

## Version

Current version: `1.0.0`

Check for updates:

```bash
superinstance update --check
```
