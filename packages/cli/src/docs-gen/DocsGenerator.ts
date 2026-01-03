/**
 * DocsGenerator - Generate documentation from CLI specifications
 *
 * Generates markdown, HTML, man pages, and API reference documentation
 * from command definitions and help system.
 */

import { CommandDefinition, ComponentHelp, HelpSystem } from '../help/index.js';

/**
 * Markdown generation options
 */
export interface MarkdownOptions {
  includeToc?: boolean;
  includeExamples?: boolean;
  outputDir?: string;
}

/**
 * HTML generation options
 */
export interface HTMLOptions {
  includeStyles?: boolean;
  includeSearch?: boolean;
  outputDir?: string;
}

/**
 * Man page generation options
 */
export interface ManPageOptions {
  section?: number;
  author?: string;
  outputDir?: string;
}

/**
 * API reference generation options
 */
export interface APIReferenceOptions {
  includeTypes?: boolean;
  includeInterfaces?: boolean;
  outputDir?: string;
}

/**
 * Main DocsGenerator class
 */
export class DocsGenerator {
  private helpSystem: HelpSystem;

  constructor() {
    this.helpSystem = new HelpSystem();
  }

  /**
   * Generate markdown documentation for a command
   */
  generateMarkdown(command: CommandDefinition, options: MarkdownOptions = {}): string {
    const { includeToc = true, includeExamples = true } = options;

    const lines: string[] = [];

    // Title
    lines.push(`# ${command.name.charAt(0).toUpperCase() + command.name.slice(1)} Command\n`);

    // Table of contents
    if (includeToc) {
      lines.push('## Table of Contents\n');
      lines.push('- [Description](#description)');
      lines.push('- [Usage](#usage)');
      if (includeExamples) {
        lines.push('- [Examples](#examples)');
      }
      lines.push('- [Options](#options)');
      if (command.aliases && command.aliases.length > 0) {
        lines.push('- [Aliases](#aliases)');
      }
      if (command.relatedCommands && command.relatedCommands.length > 0) {
        lines.push('- [Related Commands](#related-commands)');
      }
      lines.push('');
    }

    // Description
    lines.push('## Description\n');
    lines.push(`${command.description}\n`);

    // Usage
    lines.push('## Usage\n');
    lines.push('```');
    lines.push(command.usage);
    lines.push('```\n');

    // Examples
    if (includeExamples && command.examples.length > 0) {
      lines.push('## Examples\n');
      command.examples.forEach((example, i) => {
        lines.push(`${i + 1}. ${example}`);
      });
      lines.push('');
    }

    // Options
    lines.push('## Options\n');
    if (command.options.length > 0) {
      lines.push('| Option | Description |');
      lines.push('|--------|-------------|');
      command.options.forEach((option) => {
        let desc = option.description;
        if (option.defaultValue) {
          desc += ` (default: \`${option.defaultValue}\`)`;
        }
        if (option.required) {
          desc += ' **[required]**';
        }
        lines.push(`| \`${option.flag}\` | ${desc} |`);
      });
      lines.push('');
    }

    // Aliases
    if (command.aliases && command.aliases.length > 0) {
      lines.push('## Aliases\n');
      command.aliases.forEach((alias) => {
        lines.push(`- \`${alias}\``);
      });
      lines.push('');
    }

    // Related commands
    if (command.relatedCommands && command.relatedCommands.length > 0) {
      lines.push('## Related Commands\n');
      command.relatedCommands.forEach((related) => {
        const relatedCmd = this.helpSystem['commands'].get(related);
        lines.push(
          `- [\`${related}\`](./${related}.md) - ${relatedCmd ? relatedCmd.description : ''}`
        );
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generate HTML documentation for a command
   */
  generateHTML(command: CommandDefinition, options: HTMLOptions = {}): string {
    const { includeStyles = true, includeSearch = false } = options;

    const html: string[] = [];

    if (includeStyles) {
      html.push(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${command.name} - Aequor CLI</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      border-bottom: 2px solid #007bff;
      padding-bottom: 10px;
    }
    h2 {
      margin-top: 30px;
      color: #007bff;
    }
    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
    }
    pre {
      background: #f4f4f4;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
    }
    pre code {
      background: none;
      padding: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: left;
    }
    th {
      background: #007bff;
      color: white;
    }
    tr:nth-child(even) {
      background: #f9f9f9;
    }
    .required {
      color: #dc3545;
      font-weight: bold;
    }
    .alias {
      background: #e7f3ff;
      padding: 5px 10px;
      border-radius: 3px;
      margin-right: 5px;
    }
  </style>
</head>
<body>
`);
    }

    html.push(`<h1>${command.name.charAt(0).toUpperCase() + command.name.slice(1)} Command</h1>`);
    html.push(`<p>${command.description}</p>`);

    html.push('<h2>Usage</h2>');
    html.push('<pre><code>' + this.escapeHTML(command.usage) + '</code></pre>');

    if (command.examples.length > 0) {
      html.push('<h2>Examples</h2>');
      html.push('<ol>');
      command.examples.forEach((example) => {
        html.push(`<li><code>${this.escapeHTML(example)}</code></li>`);
      });
      html.push('</ol>');
    }

    html.push('<h2>Options</h2>');
    html.push('<table>');
    html.push('<thead><tr><th>Option</th><th>Description</th></tr></thead>');
    html.push('<tbody>');
    command.options.forEach((option) => {
      let desc = option.description;
      if (option.defaultValue) {
        desc += ` (default: <code>${option.defaultValue}</code>)`;
      }
      if (option.required) {
        desc += ' <span class="required">[required]</span>';
      }
      html.push(`<tr><td><code>${this.escapeHTML(option.flag)}</code></td><td>${desc}</td></tr>`);
    });
    html.push('</tbody></table>');

    if (command.aliases && command.aliases.length > 0) {
      html.push('<h2>Aliases</h2>');
      html.push('<div>');
      command.aliases.forEach((alias) => {
        html.push(`<span class="alias">${alias}</span>`);
      });
      html.push('</div>');
    }

    if (command.relatedCommands && command.relatedCommands.length > 0) {
      html.push('<h2>Related Commands</h2>');
      html.push('<ul>');
      command.relatedCommands.forEach((related) => {
        const relatedCmd = this.helpSystem['commands'].get(related);
        html.push(
          `<li><a href="${related}.html">${related}</a> - ${relatedCmd ? relatedCmd.description : ''}</li>`
        );
      });
      html.push('</ul>');
    }

    if (includeStyles) {
      html.push('</body></html>');
    }

    return html.join('\n');
  }

  /**
   * Generate man page for a command
   */
  generateManPage(command: CommandDefinition, options: ManPageOptions = {}): string {
    const { section = 1, author = 'Aequor Project' } = options;

    const date = new Date().toISOString().split('T')[0];
    const lines: string[] = [];

    lines.push('.\\" Man page for ' + command.name);
    lines.push('.\\" Generated by Aequor DocsGenerator');
    lines.push('.\\" ' + date);
    lines.push('.TH ' + command.name.toUpperCase() + ' ' + section + ' "' + date + '" "" "' + author + '"');
    lines.push('.SH NAME');
    lines.push(command.name + ' \\- ' + command.description);
    lines.push('.SH SYNOPSIS');
    lines.push('.B ' + command.name);
    lines.push('[options]');
    lines.push('.SH DESCRIPTION');
    lines.push(command.description);
    lines.push('.SH OPTIONS');

    command.options.forEach((option) => {
      lines.push('.TP');
      lines.push('.B ' + option.flag);
      lines.push(option.description);
      if (option.defaultValue) {
        lines.push('.RS');
        lines.push('.IP');
        lines.push('Default: ' + option.defaultValue);
        lines.push('.RE');
      }
    });

    if (command.examples.length > 0) {
      lines.push('.SH EXAMPLES');
      command.examples.forEach((example) => {
        lines.push('.TP');
        lines.push(example);
      });
    }

    if (command.aliases && command.aliases.length > 0) {
      lines.push('.SH ALIASES');
      command.aliases.forEach((alias) => {
        lines.push('.TP');
        lines.push('.B ' + alias);
      });
    }

    if (command.relatedCommands && command.relatedCommands.length > 0) {
      lines.push('.SH "SEE ALSO"');
      command.relatedCommands.forEach((related, i) => {
        lines.push(related + (1) + (i < command.relatedCommands!.length - 1 ? ', ' : ''));
      });
    }

    lines.push('.SH AUTHOR');
    lines.push(author);

    return lines.join('\n');
  }

  /**
   * Generate API reference
   */
  generateAPI(options: APIReferenceOptions = {}): string {
    const { includeTypes = true, includeInterfaces = true } = options;

    const lines: string[] = [];

    lines.push('# Aequor CLI API Reference\n');
    lines.push('This document provides a comprehensive reference for the Aequor CLI API.\n');

    if (includeInterfaces) {
      lines.push('## Interfaces\n');
      lines.push('### CommandDefinition\n');
      lines.push('```typescript');
      lines.push('interface CommandDefinition {');
      lines.push('  name: string;');
      lines.push('  description: string;');
      lines.push('  usage: string;');
      lines.push('  examples: string[];');
      lines.push('  options: CommandOption[];');
      lines.push('  aliases?: string[];');
      lines.push('  relatedCommands?: string[];');
      lines.push('  seeAlso?: string[];');
      lines.push('}');
      lines.push('```\n');

      lines.push('### CommandOption\n');
      lines.push('```typescript');
      lines.push('interface CommandOption {');
      lines.push('  flag: string;');
      lines.push('  description: string;');
      lines.push('  defaultValue?: string;');
      lines.push('  required?: boolean;');
      lines.push('}');
      lines.push('```\n');

      lines.push('### ComponentHelp\n');
      lines.push('```typescript');
      lines.push('interface ComponentHelp {');
      lines.push('  name: string;');
      lines.push('  type: string;');
      lines.push('  description: string;');
      lines.push('  usage: string[];');
      lines.push('  configuration: Record<string, string>;');
      lines.push('  examples: string[];');
      lines.push('}');
      lines.push('```\n');
    }

    if (includeTypes) {
      lines.push('## Types\n');
      lines.push('### HelpResult\n');
      lines.push('```typescript');
      lines.push('interface HelpResult {');
      lines.push('  title: string;');
      lines.push('  content: string;');
      lines.push('  related?: string[];');
      lines.push('}');
      lines.push('```\n');

      lines.push('### TroubleshootingTip\n');
      lines.push('```typescript');
      lines.push('interface TroubleshootingTip {');
      lines.push('  issue: string;');
      lines.push('  symptoms: string[];');
      lines.push('  solutions: string[];');
      lines.push('  related?: string[];');
      lines.push('}');
      lines.push('```\n');
    }

    lines.push('## Classes\n');
    lines.push('### HelpSystem\n');
    lines.push('Main help system class for command and component documentation.\n');
    lines.push('#### Methods\n');
    lines.push('- `showCommand(commandName: string): string` - Show help for a command');
    lines.push('- `showComponent(componentName: string): string` - Show help for a component');
    lines.push('- `generateExamples(componentName: string): string[]` - Generate examples');
    lines.push('- `showTroubleshooting(issue: string): string` - Show troubleshooting tips');
    lines.push('- `interactive(query: string): HelpResult[]` - Interactive search');
    lines.push('- `listCommands(): string` - List all commands');
    lines.push('- `listComponents(): string` - List all components\n');

    lines.push('### DocsGenerator\n');
    lines.push('Documentation generator class.\n');
    lines.push('#### Methods\n');
    lines.push('- `generateMarkdown(command: CommandDefinition, options?: MarkdownOptions): string`');
    lines.push('- `generateHTML(command: CommandDefinition, options?: HTMLOptions): string`');
    lines.push('- `generateManPage(command: CommandDefinition, options?: ManPageOptions): string`');
    lines.push('- `generateAPI(options?: APIReferenceOptions): string`\n');

    return lines.join('\n');
  }

  /**
   * Generate all documentation
   */
  async generateAll(
    outputDir: string,
    formats: ('markdown' | 'html' | 'manpage')[] = ['markdown', 'html', 'manpage']
  ): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');

    // Create output directories
    for (const format of formats) {
      const dir = path.join(outputDir, format);
      await fs.mkdir(dir, { recursive: true });
    }

    // Generate documentation for each command
    const commands = this.helpSystem['commands'] as Map<string, CommandDefinition>;

    for (const [name, command] of commands.entries()) {
      if (formats.includes('markdown')) {
        const markdown = this.generateMarkdown(command, { includeToc: true, includeExamples: true });
        await fs.writeFile(path.join(outputDir, 'markdown', `${name}.md`), markdown);
      }

      if (formats.includes('html')) {
        const html = this.generateHTML(command, { includeStyles: true, includeSearch: false });
        await fs.writeFile(path.join(outputDir, 'html', `${name}.html`), html);
      }

      if (formats.includes('manpage')) {
        const manpage = this.generateManPage(command, { section: 1 });
        await fs.writeFile(path.join(outputDir, 'manpage', `${name}.1`), manpage);
      }
    }

    // Generate API reference
    const api = this.generateAPI({ includeTypes: true, includeInterfaces: true });
    await fs.writeFile(path.join(outputDir, 'API.md'), api);

    // Generate index
    const index = this.generateIndex();
    await fs.writeFile(path.join(outputDir, 'index.html'), index);
  }

  /**
   * Generate documentation index
   */
  private generateIndex(): string {
    const commands = this.helpSystem['commands'] as Map<string, CommandDefinition>;

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aequor CLI Documentation</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      border-bottom: 2px solid #007bff;
      padding-bottom: 10px;
    }
    .command-list {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
    .command-card {
      border: 1px solid #ddd;
      border-radius: 5px;
      padding: 15px;
      transition: box-shadow 0.3s;
    }
    .command-card:hover {
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
    .command-name {
      font-size: 1.2em;
      font-weight: bold;
      color: #007bff;
      margin-bottom: 5px;
    }
    .command-desc {
      color: #666;
      margin-bottom: 10px;
    }
    .command-link {
      color: #007bff;
      text-decoration: none;
    }
    .command-link:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <h1>Aequor CLI Documentation</h1>
  <p>Welcome to the Aequor CLI documentation. Select a command to learn more.</p>

  <div class="command-list">
    ${Array.from(commands.entries())
      .map(
        ([name, cmd]) => `
    <div class="command-card">
      <div class="command-name">${name}</div>
      <div class="command-desc">${cmd.description}</div>
      <a class="command-link" href="html/${name}.html">View Documentation</a>
    </div>
    `
      )
      .join('')}
  </div>

  <h2 style="margin-top: 40px;">Other Resources</h2>
  <ul>
    <li><a href="API.md">API Reference</a></li>
    <li><a href="https://github.com/SuperInstance/SmartCRDT">GitHub Repository</a></li>
  </ul>
</body>
</html>
`;

    return html;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHTML(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
