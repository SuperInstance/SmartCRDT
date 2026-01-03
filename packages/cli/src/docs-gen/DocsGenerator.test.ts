/**
 * Tests for DocsGenerator
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocsGenerator } from './DocsGenerator.js';
import type { CommandDefinition } from '../help/index.js';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  mkdir: vi.fn(() => Promise.resolve()),
  writeFile: vi.fn(() => Promise.resolve()),
}));

describe('DocsGenerator', () => {
  let generator: DocsGenerator;
  let mockCommand: CommandDefinition;

  beforeEach(() => {
    generator = new DocsGenerator();
    mockCommand = {
      name: 'test',
      description: 'Test command description',
      usage: 'aequor test [options]',
      examples: ['aequor test', 'aequor test --verbose'],
      options: [
        {
          flag: '-v, --verbose',
          description: 'Verbose output',
          defaultValue: 'false',
        },
        {
          flag: '-h, --help',
          description: 'Show help',
          required: true,
        },
      ],
      aliases: ['t', 'test-cmd'],
      relatedCommands: ['query', 'chat'],
    };
  });

  describe('generateMarkdown', () => {
    it('should generate markdown with all sections', () => {
      const markdown = generator.generateMarkdown(mockCommand, { includeToc: true, includeExamples: true });

      expect(markdown).toContain('# Test Command');
      expect(markdown).toContain('## Table of Contents');
      expect(markdown).toContain('## Description');
      expect(markdown).toContain('## Usage');
      expect(markdown).toContain('## Examples');
      expect(markdown).toContain('## Options');
      expect(markdown).toContain('## Aliases');
      expect(markdown).toContain('## Related Commands');
    });

    it('should generate markdown without TOC when disabled', () => {
      const markdown = generator.generateMarkdown(mockCommand, { includeToc: false });

      expect(markdown).not.toContain('## Table of Contents');
    });

    it('should generate markdown without examples when disabled', () => {
      const markdown = generator.generateMarkdown(mockCommand, { includeExamples: false });

      expect(markdown).not.toContain('## Examples');
    });

    it('should format options as table', () => {
      const markdown = generator.generateMarkdown(mockCommand);

      expect(markdown).toContain('| Option | Description |');
      expect(markdown).toContain('| `-v, --verbose` |');
      expect(markdown).toContain('`false`');
    });

    it('should mark required options', () => {
      const markdown = generator.generateMarkdown(mockCommand);

      expect(markdown).toContain('**[required]**');
    });
  });

  describe('generateHTML', () => {
    it('should generate HTML with styles', () => {
      const html = generator.generateHTML(mockCommand, { includeStyles: true });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<style>');
      expect(html).toContain('</style>');
    });

    it('should generate HTML without styles when disabled', () => {
      const html = generator.generateHTML(mockCommand, { includeStyles: false });

      expect(html).not.toContain('<!DOCTYPE html>');
      expect(html).not.toContain('<style>');
    });

    it('should include all command sections', () => {
      const html = generator.generateHTML(mockCommand);

      expect(html).toContain('<h1>Test Command</h1>');
      expect(html).toContain('<h2>Usage</h2>');
      expect(html).toContain('<h2>Examples</h2>');
      expect(html).toContain('<h2>Options</h2>');
    });

    it('should escape HTML in command options', () => {
      const commandWithSpecialChars: CommandDefinition = {
        ...mockCommand,
        options: [
          {
            flag: '-f, --file <path>',
            description: 'File path with "quotes" and <angles>',
          },
        ],
      };

      const html = generator.generateHTML(commandWithSpecialChars);
      expect(html).toContain('&quot;');
      expect(html).toContain('&lt;');
      expect(html).toContain('&gt;');
    });

    it('should render options as table', () => {
      const html = generator.generateHTML(mockCommand);

      expect(html).toContain('<table>');
      expect(html).toContain('<thead>');
      expect(html).toContain('<tbody>');
      expect(html).toContain('<th>Option</th>');
      expect(html).toContain('<th>Description</th>');
    });
  });

  describe('generateManPage', () => {
    it('should generate man page with all sections', () => {
      const manpage = generator.generateManPage(mockCommand);

      expect(manpage).toContain('.TH TEST');
      expect(manpage).toContain('.SH NAME');
      expect(manpage).toContain('.SH SYNOPSIS');
      expect(manpage).toContain('.SH DESCRIPTION');
      expect(manpage).toContain('.SH OPTIONS');
      expect(manpage).toContain('.SH EXAMPLES');
    });

    it('should include default values', () => {
      const manpage = generator.generateManPage(mockCommand);

      expect(manpage).toContain('Default: false');
    });

    it('should use custom section and author', () => {
      const manpage = generator.generateManPage(mockCommand, { section: 8, author: 'Test Author' });

      expect(manpage).toContain('.TH TEST 8');
      expect(manpage).toContain('Test Author');
    });
  });

  describe('generateAPI', () => {
    it('should generate API reference with types and interfaces', () => {
      const api = generator.generateAPI({ includeTypes: true, includeInterfaces: true });

      expect(api).toContain('# Aequor CLI API Reference');
      expect(api).toContain('## Interfaces');
      expect(api).toContain('## Types');
      expect(api).toContain('interface CommandDefinition');
      expect(api).toContain('interface CommandOption');
      expect(api).toContain('interface ComponentHelp');
    });

    it('should skip types when disabled', () => {
      const api = generator.generateAPI({ includeTypes: false, includeInterfaces: true });

      expect(api).not.toContain('## Types');
      expect(api).toContain('## Interfaces');
    });

    it('should skip interfaces when disabled', () => {
      const api = generator.generateAPI({ includeTypes: true, includeInterfaces: false });

      expect(api).not.toContain('## Interfaces');
      expect(api).toContain('## Types');
    });

    it('should document HelpSystem class', () => {
      const api = generator.generateAPI();

      expect(api).toContain('### HelpSystem');
      expect(api).toContain('showCommand');
      expect(api).toContain('showComponent');
      expect(api).toContain('generateExamples');
    });

    it('should document DocsGenerator class', () => {
      const api = generator.generateAPI();

      expect(api).toContain('### DocsGenerator');
      expect(api).toContain('generateMarkdown');
      expect(api).toContain('generateHTML');
      expect(api).toContain('generateManPage');
    });
  });

  describe('generateAll', () => {
    it('should generate all formats', async () => {
      await generator.generateAll('/tmp/test-docs', ['markdown', 'html', 'manpage']);

      // Verify that the mock functions were called
      const fs = await import('fs/promises');
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should generate only specified formats', async () => {
      await generator.generateAll('/tmp/test-docs', ['markdown']);

      const fs = await import('fs/promises');
      expect(fs.writeFile).toHaveBeenCalled();
    });
  });

  describe('HTML escaping', () => {
    it('should escape special characters', () => {
      const commandWithSpecialChars: CommandDefinition = {
        ...mockCommand,
        usage: 'aequor test "<input>" & output',
      };

      const html = generator.generateHTML(commandWithSpecialChars);
      expect(html).toContain('&lt;input&gt;');
      expect(html).toContain('&amp;');
    });
  });
});
