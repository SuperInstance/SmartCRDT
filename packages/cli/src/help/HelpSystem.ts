/**
 * HelpSystem - Comprehensive help and documentation system for Aequor CLI
 *
 * Provides command help, component help, usage examples, troubleshooting tips,
 * and interactive help with fuzzy search capabilities.
 */

import chalk from 'chalk';
import Table from 'cli-table3';

/**
 * Command definition interface
 */
export interface CommandDefinition {
  name: string;
  description: string;
  usage: string;
  examples: string[];
  options: CommandOption[];
  aliases?: string[];
  relatedCommands?: string[];
  seeAlso?: string[];
}

/**
 * Command option interface
 */
export interface CommandOption {
  flag: string;
  description: string;
  defaultValue?: string;
  required?: boolean;
}

/**
 * Help result interface
 */
export interface HelpResult {
  title: string;
  content: string;
  related?: string[];
}

/**
 * Component help interface
 */
export interface ComponentHelp {
  name: string;
  type: string;
  description: string;
  usage: string[];
  configuration: Record<string, string>;
  examples: string[];
}

/**
 * Troubleshooting tip interface
 */
export interface TroubleshootingTip {
  issue: string;
  symptoms: string[];
  solutions: string[];
  related?: string[];
}

/**
 * Main HelpSystem class
 */
export class HelpSystem {
  private commands: Map<string, CommandDefinition>;
  private components: Map<string, ComponentHelp>;
  private troubleshooting: Map<string, TroubleshootingTip[]>;

  constructor() {
    this.commands = new Map();
    this.components = new Map();
    this.troubleshooting = new Map();
    this.initializeCommandDefinitions();
    this.initializeComponentHelp();
    this.initializeTroubleshooting();
  }

  /**
   * Show help for a specific command
   */
  showCommand(commandName: string): string {
    const command = this.commands.get(commandName);
    if (!command) {
      return chalk.red(`Unknown command: ${commandName}`);
    }

    const lines: string[] = [];

    // Title
    lines.push(chalk.cyan.bold(`\n${command.name.toUpperCase()}\n`));
    lines.push(chalk.grey('═'.repeat(60)));

    // Description
    lines.push(chalk.yellow(`\nDescription:`));
    lines.push(`  ${command.description}\n`);

    // Usage
    lines.push(chalk.yellow(`Usage:`));
    lines.push(chalk.cyan(`  ${command.usage}\n`));

    // Examples
    if (command.examples.length > 0) {
      lines.push(chalk.yellow(`Examples:\n`));
      command.examples.forEach((example, i) => {
        lines.push(chalk.cyan(`  ${i + 1}. ${example}`));
      });
      lines.push('');
    }

    // Options
    if (command.options.length > 0) {
      lines.push(chalk.yellow(`Options:\n`));

      const table = new Table({
        head: [chalk.cyan('Option'), chalk.cyan('Description')],
        colWidths: [25, 50],
        chars: {
          top: '',
          'top-mid': '',
          'top-left': '',
          'top-right': '',
          bottom: '',
          'bottom-mid': '',
          'bottom-left': '',
          'bottom-right': '',
          left: '',
          'left-mid': '',
          mid: '',
          'mid-mid': '',
          right: '',
          'right-mid': '',
          middle: ' ',
        },
        style: {
          head: [],
          border: [],
        },
      });

      command.options.forEach((option) => {
        let desc = option.description;
        if (option.defaultValue) {
          desc += chalk.grey(` (default: ${option.defaultValue})`);
        }
        if (option.required) {
          desc += chalk.red(' [required]');
        }
        table.push([chalk.cyan(option.flag), desc]);
      });

      lines.push(table.toString());
      lines.push('');
    }

    // Aliases
    if (command.aliases && command.aliases.length > 0) {
      lines.push(chalk.yellow(`Aliases:`));
      lines.push(`  ${command.aliases.join(', ')}\n`);
    }

    // Related commands
    if (command.relatedCommands && command.relatedCommands.length > 0) {
      lines.push(chalk.yellow(`Related Commands:`));
      command.relatedCommands.forEach((related) => {
        lines.push(`  ${chalk.cyan(related.padEnd(20))} ${this.commands.get(related)?.description || ''}`);
      });
      lines.push('');
    }

    // See also
    if (command.seeAlso && command.seeAlso.length > 0) {
      lines.push(chalk.yellow(`See Also:`));
      command.seeAlso.forEach((ref) => {
        lines.push(`  - ${ref}`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Show help for a component
   */
  showComponent(componentName: string): string {
    const component = this.components.get(componentName);
    if (!component) {
      return chalk.red(`Unknown component: ${componentName}`);
    }

    const lines: string[] = [];

    // Title
    lines.push(chalk.cyan.bold(`\n${component.name}\n`));
    lines.push(chalk.grey('═'.repeat(60)));

    // Type and description
    lines.push(chalk.yellow(`\nType: ${chalk.cyan(component.type)}`));
    lines.push(chalk.yellow(`Description:`));
    lines.push(`  ${component.description}\n`);

    // Usage
    if (component.usage.length > 0) {
      lines.push(chalk.yellow(`Usage:\n`));
      component.usage.forEach((usage) => {
        lines.push(chalk.cyan(`  ${usage}`));
      });
      lines.push('');
    }

    // Configuration
    if (Object.keys(component.configuration).length > 0) {
      lines.push(chalk.yellow(`Configuration:\n`));

      const table = new Table({
        head: [chalk.cyan('Setting'), chalk.cyan('Description')],
        colWidths: [30, 40],
        chars: {
          top: '',
          'top-mid': '',
          'top-left': '',
          'top-right': '',
          bottom: '',
          'bottom-mid': '',
          'bottom-left': '',
          'bottom-right': '',
          left: '',
          'left-mid': '',
          mid: '',
          'mid-mid': '',
          right: '',
          'right-mid': '',
          middle: ' ',
        },
        style: {
          head: [],
          border: [],
        },
      });

      Object.entries(component.configuration).forEach(([key, value]) => {
        table.push([chalk.cyan(key), value]);
      });

      lines.push(table.toString());
      lines.push('');
    }

    // Examples
    if (component.examples.length > 0) {
      lines.push(chalk.yellow(`Examples:\n`));
      component.examples.forEach((example, i) => {
        lines.push(chalk.cyan(`  ${i + 1}. ${example}`));
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generate usage examples for a component
   */
  generateExamples(componentName: string): string[] {
    const command = this.commands.get(componentName);
    if (!command) {
      return [];
    }
    return command.examples;
  }

  /**
   * Show troubleshooting tips for an issue
   */
  showTroubleshooting(issue: string): string {
    const tips = this.troubleshooting.get(issue.toLowerCase());
    if (!tips || tips.length === 0) {
      // Try fuzzy search
      const allIssues = Array.from(this.troubleshooting.keys());
      const matched = allIssues.find((key) => key.includes(issue.toLowerCase()) || issue.toLowerCase().includes(key));
      if (matched) {
        return this.showTroubleshooting(matched);
      }
      return chalk.red(`No troubleshooting tips found for: ${issue}`);
    }

    const lines: string[] = [];

    lines.push(chalk.cyan.bold(`\nTroubleshooting: ${issue}\n`));
    lines.push(chalk.grey('═'.repeat(60)));

    tips.forEach((tip, index) => {
      lines.push(chalk.yellow(`\n${index + 1}. ${tip.issue}\n`));

      if (tip.symptoms.length > 0) {
        lines.push(chalk.grey('Symptoms:'));
        tip.symptoms.forEach((symptom) => {
          lines.push(chalk.grey(`  • ${symptom}`));
        });
        lines.push('');
      }

      lines.push(chalk.cyan('Solutions:'));
      tip.solutions.forEach((solution) => {
        lines.push(`  ${chalk.green('✓')} ${solution}`);
      });

      if (tip.related && tip.related.length > 0) {
        lines.push('');
        lines.push(chalk.grey('Related:'));
        tip.related.forEach((related) => {
          lines.push(chalk.grey(`  • ${related}`));
        });
      }
    });

    return lines.join('\n') + '\n';
  }

  /**
   * Interactive help with fuzzy search
   */
  interactive(query: string): HelpResult[] {
    const results: HelpResult[] = [];
    const lowerQuery = query.toLowerCase();

    // Search commands
    this.commands.forEach((command) => {
      if (
        command.name.includes(lowerQuery) ||
        command.description.toLowerCase().includes(lowerQuery) ||
        command.aliases?.some((alias) => alias.includes(lowerQuery))
      ) {
        results.push({
          title: `${command.name} - Command`,
          content: command.description,
          related: command.relatedCommands,
        });
      }
    });

    // Search components
    this.components.forEach((component) => {
      if (
        component.name.toLowerCase().includes(lowerQuery) ||
        component.description.toLowerCase().includes(lowerQuery) ||
        component.type.toLowerCase().includes(lowerQuery)
      ) {
        results.push({
          title: `${component.name} - Component`,
          content: component.description,
        });
      }
    });

    // Search troubleshooting
    this.troubleshooting.forEach((tips, issue) => {
      if (issue.includes(lowerQuery)) {
        tips.forEach((tip) => {
          results.push({
            title: `Troubleshooting: ${tip.issue}`,
            content: tip.solutions.join('; '),
            related: tip.related,
          });
        });
      }
    });

    return results;
  }

  /**
   * List all available commands
   */
  listCommands(): string {
    const lines: string[] = [];

    lines.push(chalk.cyan.bold('\nAvailable Commands\n'));
    lines.push(chalk.grey('═'.repeat(60)));

    const table = new Table({
      head: [chalk.cyan('Command'), chalk.cyan('Description')],
      colWidths: [20, 50],
      chars: {
        top: '',
        'top-mid': '',
        'top-left': '',
        'top-right': '',
        bottom: '',
        'bottom-mid': '',
        'bottom-left': '',
        'bottom-right': '',
        left: '',
        'left-mid': '',
        mid: '',
        'mid-mid': '',
        right: '',
        'right-mid': '',
        middle: ' ',
      },
      style: {
        head: [],
        border: [],
      },
    });

    const sortedCommands = Array.from(this.commands.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    sortedCommands.forEach(([name, command]) => {
      table.push([chalk.cyan(name), command.description]);
    });

    lines.push(table.toString());
    lines.push('');
    lines.push(chalk.grey('Use ') + chalk.cyan('aequor help <command>') + chalk.grey(' for more information on a command.'));

    return lines.join('\n') + '\n';
  }

  /**
   * List all available components
   */
  listComponents(): string {
    const lines: string[] = [];

    lines.push(chalk.cyan.bold('\nAvailable Components\n'));
    lines.push(chalk.grey('═'.repeat(60)));

    const grouped = new Map<string, ComponentHelp[]>();
    this.components.forEach((component) => {
      if (!grouped.has(component.type)) {
        grouped.set(component.type, []);
      }
      grouped.get(component.type)!.push(component);
    });

    grouped.forEach((components, type) => {
      lines.push(chalk.yellow(`\n${type.toUpperCase()}\n`));

      const table = new Table({
        head: [chalk.cyan('Component'), chalk.cyan('Description')],
        colWidths: [25, 45],
        chars: {
          top: '',
          'top-mid': '',
          'top-left': '',
          'top-right': '',
          bottom: '',
          'bottom-mid': '',
          'bottom-left': '',
          'bottom-right': '',
          left: '',
          'left-mid': '',
          mid: '',
          'mid-mid': '',
          right: '',
          'right-mid': '',
          middle: ' ',
        },
        style: {
          head: [],
          border: [],
        },
      });

      components.forEach((component) => {
        table.push([chalk.cyan(component.name), component.description]);
      });

      lines.push(table.toString());
    });

    return lines.join('\n') + '\n';
  }

  /**
   * Show quick start guide
   */
  showQuickStart(): string {
    const lines: string[] = [];

    lines.push(chalk.cyan.bold('\nAequor Quick Start Guide\n'));
    lines.push(chalk.grey('═'.repeat(60)));

    lines.push(chalk.yellow('\n1. First-Time Setup\n'));
    lines.push(chalk.cyan('   # Enable caching\n'));
    lines.push(chalk.cyan('   aequor config cache.enabled true\n'));
    lines.push(chalk.cyan('   # Set privacy level\n'));
    lines.push(chalk.cyan('   aequor config privacy.epsilon 1.0\n'));

    lines.push(chalk.yellow('\n2. Run Your First Query\n'));
    lines.push(chalk.cyan('   aequor query "What is Aequor?"\n'));

    lines.push(chalk.yellow('\n3. Check Cache Performance\n'));
    lines.push(chalk.cyan('   aequor cache stats\n'));

    lines.push(chalk.yellow('\n4. Analyze Query Privacy\n'));
    lines.push(chalk.cyan('   aequor privacy "My email is user@example.com"\n'));

    lines.push(chalk.yellow('\n5. Start Interactive Chat\n'));
    lines.push(chalk.cyan('   aequor chat\n'));

    lines.push(chalk.yellow('\n6. Export Your Data\n'));
    lines.push(chalk.cyan('   aequor export -o backup.json\n'));

    lines.push(chalk.grey('\nFor more help:\n'));
    lines.push(chalk.cyan('   aequor help <command>'));
    lines.push(chalk.cyan('   aequor examples'));
    lines.push(chalk.cyan('   aequor list-components\n'));

    return lines.join('\n') + '\n';
  }

  /**
   * Initialize command definitions
   */
  private initializeCommandDefinitions(): void {
    // Query command
    this.commands.set('query', {
      name: 'query',
      description: 'Execute a query with intelligent routing',
      usage: 'aequor query [options] "<query>"',
      examples: [
        'aequor query "What is 2+2?"',
        'aequor query "Explain quantum computing" --backend cloud',
        'aequor query "How do I sort an array?" --trace',
        'aequor query "Write a function" --format json',
      ],
      options: [
        { flag: '-b, --backend <type>', description: 'Force backend (local, cloud, auto)', defaultValue: 'auto' },
        { flag: '-m, --model <name>', description: 'Use specific model' },
        { flag: '-f, --format <type>', description: 'Output format (text, json)', defaultValue: 'text' },
        { flag: '-t, --trace', description: 'Show routing trace' },
        { flag: '--no-cache', description: 'Bypass cache' },
        { flag: '-v, --verbose', description: 'Verbose output' },
        { flag: '-h, --help', description: 'Show help' },
      ],
      relatedCommands: ['chat', 'models', 'cache'],
    });

    // Chat command
    this.commands.set('chat', {
      name: 'chat',
      description: 'Start interactive chat session',
      usage: 'aequor chat [options]',
      examples: [
        'aequor chat',
        'aequor chat --backend local',
        'aequor chat --model gpt-4',
        'aequor chat --history session.json',
      ],
      options: [
        { flag: '-b, --backend <type>', description: 'Force backend (local, cloud, auto)', defaultValue: 'auto' },
        { flag: '-m, --model <name>', description: 'Use specific model' },
        { flag: '--no-cache', description: 'Bypass cache' },
        { flag: '--history <file>', description: 'Load chat history from file' },
        { flag: '-h, --help', description: 'Show help' },
      ],
      relatedCommands: ['query', 'export'],
    });

    // Status command
    this.commands.set('status', {
      name: 'status',
      description: 'Show system status',
      usage: 'aequor status [options]',
      examples: [
        'aequor status',
        'aequor status --components',
        'aequor status --metrics',
      ],
      options: [
        { flag: '-c, --components', description: 'Show component status' },
        { flag: '-m, --metrics', description: 'Show performance metrics' },
        { flag: '-v, --verbose', description: 'Verbose output' },
        { flag: '-h, --help', description: 'Show help' },
      ],
      relatedCommands: ['system', 'models'],
    });

    // Cache command
    this.commands.set('cache', {
      name: 'cache',
      description: 'Manage semantic cache',
      usage: 'aequor cache <subcommand> [options]',
      examples: [
        'aequor cache stats',
        'aequor cache clear',
        'aequor cache warm',
        'aequor cache invalidate pattern',
      ],
      options: [
        { flag: '-h, --help', description: 'Show help' },
      ],
      relatedCommands: ['query', 'config'],
    });

    // Config command
    this.commands.set('config', {
      name: 'config',
      description: 'Manage configuration',
      usage: 'aequor config [options] [key] [value]',
      examples: [
        'aequor config --list',
        'aequor config cache.enabled true',
        'aequor config privacy.epsilon 1.0',
        'aequor config --get cache.size',
      ],
      options: [
        { flag: '--list', description: 'List all configuration' },
        { flag: '--get <key>', description: 'Get configuration value' },
        { flag: '--set <key> <value>', description: 'Set configuration value' },
        { flag: '--reset', description: 'Reset to defaults' },
        { flag: '--global', description: 'Use global config' },
        { flag: '--local', description: 'Use local config' },
        { flag: '-h, --help', description: 'Show help' },
      ],
      relatedCommands: ['status', 'cache'],
    });

    // Models command
    this.commands.set('models', {
      name: 'models',
      description: 'List available models',
      usage: 'aequor models [options]',
      examples: [
        'aequor models',
        'aequor models --backend local',
        'aequor models --detailed',
      ],
      options: [
        { flag: '-b, --backend <type>', description: 'Filter by backend (local, cloud)' },
        { flag: '-d, --detailed', description: 'Show detailed information' },
        { flag: '--local', description: 'Show local models only' },
        { flag: '--cloud', description: 'Show cloud models only' },
        { flag: '-h, --help', description: 'Show help' },
      ],
      relatedCommands: ['query', 'chat'],
    });

    // Cost command
    this.commands.set('cost', {
      name: 'cost',
      description: 'Show cost analysis',
      usage: 'aequor cost [options]',
      examples: [
        'aequor cost',
        'aequor cost --period week',
        'aequor cost --by-backend',
      ],
      options: [
        { flag: '-p, --period <period>', description: 'Time period (today, week, month, all)', defaultValue: 'all' },
        { flag: '-b, --by-backend', description: 'Break down by backend' },
        { flag: '--breakdown', description: 'Show detailed breakdown' },
        { flag: '-h, --help', description: 'Show help' },
      ],
      relatedCommands: ['status', 'models'],
    });

    // Test command
    this.commands.set('test', {
      name: 'test',
      description: 'Run tests',
      usage: 'aequor test [options]',
      examples: [
        'aequor test',
        'aequor test --type unit',
        'aequor test --coverage',
      ],
      options: [
        { flag: '-t, --type <type>', description: 'Test type (unit, integration, e2e, performance)' },
        { flag: '--coverage', description: 'Show coverage report' },
        { flag: '--watch', description: 'Watch mode' },
        { flag: '-h, --help', description: 'Show help' },
      ],
      relatedCommands: ['status'],
    });

    // Export command
    this.commands.set('export', {
      name: 'export',
      description: 'Export data',
      usage: 'aequor export [options]',
      examples: [
        'aequor export -o backup.json',
        'aequor export -o knowledge.json -w knowledge',
        'aequor export -o data.cartridge -f cartridge -c',
      ],
      options: [
        { flag: '-o, --output <file>', description: 'Output file', required: true },
        { flag: '-f, --format <format>', description: 'Export format (json, jsonl, cartridge)', defaultValue: 'json' },
        { flag: '-w, --what <type>', description: 'What to export (all, knowledge, cache, history, training)', defaultValue: 'all' },
        { flag: '-c, --compress', description: 'Compress output' },
        { flag: '--validate', description: 'Validate before export' },
        { flag: '-h, --help', description: 'Show help' },
      ],
      relatedCommands: ['import', 'cartridge'],
    });

    // Import command
    this.commands.set('import', {
      name: 'import',
      description: 'Import data',
      usage: 'aequor import [options] <file>',
      examples: [
        'aequor import backup.json',
        'aequor import knowledge.json -t knowledge',
        'aequor import backup.json --dry-run',
      ],
      options: [
        { flag: '-m, --mode <mode>', description: 'Import mode (merge, replace)', defaultValue: 'merge' },
        { flag: '-t, --type <type>', description: 'Import type (all, knowledge, cache, history, training)', defaultValue: 'all' },
        { flag: '--validate', description: 'Validate before import' },
        { flag: '--dry-run', description: 'Preview without importing' },
        { flag: '-h, --help', description: 'Show help' },
      ],
      relatedCommands: ['export', 'cartridge'],
    });

    // Privacy command
    this.commands.set('privacy', {
      name: 'privacy',
      description: 'Privacy operations',
      usage: 'aequor privacy [options] "<query>"',
      examples: [
        'aequor privacy "My email is test@example.com"',
        'aequor privacy "What is JavaScript?" --classify --detailed',
      ],
      options: [
        { flag: '--classify', description: 'Classify query privacy level' },
        { flag: '--redact', description: 'Redact PII from query' },
        { flag: '--encode', description: 'Encode query as intent vector' },
        { flag: '--audit', description: 'Show privacy audit log' },
        { flag: '-d, --detailed', description: 'Show detailed analysis' },
        { flag: '-h, --help', description: 'Show help' },
      ],
      relatedCommands: ['config', 'query'],
    });

    // Cartridge command
    this.commands.set('cartridge', {
      name: 'cartridge',
      description: 'Manage knowledge cartridges',
      usage: 'aequor cartridge <subcommand> [options]',
      examples: [
        'aequor cartridge list',
        'aequor cartridge install my-cartridge.cartridge',
        'aequor cartridge load my-cartridge',
        'aequor cartridge create -n new-cartridge -w knowledge',
      ],
      options: [
        { flag: '-h, --help', description: 'Show help' },
      ],
      relatedCommands: ['export', 'import'],
    });

    // Training command
    this.commands.set('training', {
      name: 'training',
      description: 'Training and adapter management',
      usage: 'aequor training <subcommand> [options]',
      examples: [
        'aequor training shadow',
        'aequor training train -o data.jsonl',
        'aequor training deploy adapter.json',
      ],
      options: [
        { flag: '-h, --help', description: 'Show help' },
      ],
      relatedCommands: ['export', 'models'],
    });

    // System command
    this.commands.set('system', {
      name: 'system',
      description: 'System information and management',
      usage: 'aequor system <subcommand> [options]',
      examples: [
        'aequor system info',
        'aequor system health',
        'aequor system metrics',
      ],
      options: [
        { flag: '-h, --help', description: 'Show help' },
      ],
      relatedCommands: ['status'],
    });
  }

  /**
   * Initialize component help
   */
  private initializeComponentHelp(): void {
    // Cascade Router
    this.components.set('cascade-router', {
      name: 'cascade-router',
      type: 'routing',
      description: 'Complexity + confidence cascade routing for optimal model selection',
      usage: [
        'aequor query "simple question"  # Routes to local model',
        'aequor query "complex task"     # Routes to cloud model',
      ],
      configuration: {
        'router.backend': 'Default backend (local, cloud, auto)',
        'router.threshold': 'Complexity threshold (0-1)',
        'router.confidence': 'Minimum confidence level',
      },
      examples: [
        'Enable cascade routing: aequor config router.backend auto',
        'Set threshold: aequor config router.threshold 0.7',
      ],
    });

    // Semantic Cache
    this.components.set('semantic-cache', {
      name: 'semantic-cache',
      type: 'cache',
      description: 'High-hit-rate semantic caching for faster responses',
      usage: [
        'aequor query "question"  # Cached on first query',
        'aequor query "question"  # Served from cache',
      ],
      configuration: {
        'cache.enabled': 'Enable/disable caching',
        'cache.size': 'Cache size in MB',
        'cache.ttl': 'Time-to-live in seconds',
      },
      examples: [
        'Enable caching: aequor config cache.enabled true',
        'Set cache size: aequor config cache.size 100',
        'View stats: aequor cache stats',
      ],
    });

    // Privacy Layer
    this.components.set('privacy-layer', {
      name: 'privacy-layer',
      type: 'privacy',
      description: 'Intent encoding and redaction for query privacy',
      usage: [
        'aequor privacy "My email is user@example.com"',
        'aequor query "question"  # Automatically encoded',
      ],
      configuration: {
        'privacy.enabled': 'Enable privacy features',
        'privacy.epsilon': 'Differential privacy epsilon',
        'privacy.method': 'Privacy method (redact, encode, both)',
      },
      examples: [
        'Enable privacy: aequor config privacy.enabled true',
        'Set epsilon: aequor config privacy.epsilon 1.0',
      ],
    });

    // Intent Encoder
    this.components.set('intent-encoder', {
      name: 'intent-encoder',
      type: 'privacy',
      description: 'Encode queries as intent vectors for privacy-preserving cloud inference',
      usage: [
        'aequor privacy encode "Write a function"',
      ],
      configuration: {
        'intent.dimensions': 'Vector dimensions (default: 768)',
        'intent.model': 'Encoder model (default: all-MiniLM-L6-v2)',
      },
      examples: [
        'Encode query: aequor privacy encode "query" --encode',
      ],
    });
  }

  /**
   * Initialize troubleshooting tips
   */
  private initializeTroubleshooting(): void {
    // Cache issues
    this.troubleshooting.set('cache', [
      {
        issue: 'Cache not working',
        symptoms: ['Queries are slow', 'Cache stats show 0% hit rate'],
        solutions: [
          'Check if cache is enabled: aequor config --get cache.enabled',
          'Enable cache: aequor config cache.enabled true',
          'Check cache size: aequor config --get cache.size',
          'Clear cache: aequor cache clear',
        ],
        related: ['config', 'status'],
      },
    ]);

    // Model issues
    this.troubleshooting.set('model', [
      {
        issue: 'Model not found',
        symptoms: ['Error: Model not found', 'Local model unavailable'],
        solutions: [
          'Check available models: aequor models',
          'Verify Ollama is running: ollama list',
          'Pull model: ollama pull <model-name>',
          'Check backend: aequor config --get router.backend',
        ],
        related: ['models', 'config'],
      },
    ]);

    // Privacy issues
    this.troubleshooting.set('privacy', [
      {
        issue: 'Privacy encoding failed',
        symptoms: ['Error: Encoding failed', 'Privacy check not working'],
        solutions: [
          'Check privacy is enabled: aequor config --get privacy.enabled',
          'Verify encoder is installed',
          'Check epsilon value: aequor config --get privacy.epsilon',
          'Run diagnostics: aequor system health',
        ],
        related: ['config', 'system'],
      },
    ]);

    // Network issues
    this.troubleshooting.set('network', [
      {
        issue: 'Cannot connect to cloud API',
        symptoms: ['Timeout errors', 'Connection refused'],
        solutions: [
          'Check internet connection',
          'Verify API key is set',
          'Use local backend: aequor config router.backend local',
          'Check firewall settings',
        ],
        related: ['config', 'status'],
      },
    ]);

    // Performance issues
    this.troubleshooting.set('performance', [
      {
        issue: 'Slow response times',
        symptoms: ['Queries take > 10 seconds', 'High latency'],
        solutions: [
          'Check cache hit rate: aequor cache stats',
          'Enable caching: aequor config cache.enabled true',
          'Use local backend: aequor config router.backend local',
          'Check system metrics: aequor status --metrics',
        ],
        related: ['cache', 'status'],
      },
    ]);
  }
}
