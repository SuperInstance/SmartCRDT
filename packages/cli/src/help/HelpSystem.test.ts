/**
 * Tests for HelpSystem
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HelpSystem } from './HelpSystem.js';

describe('HelpSystem', () => {
  let helpSystem: HelpSystem;

  beforeEach(() => {
    helpSystem = new HelpSystem();
  });

  describe('showCommand', () => {
    it('should display help for a valid command', () => {
      const output = helpSystem.showCommand('query');
      expect(output).toContain('QUERY');
      expect(output).toContain('Execute a query');
      expect(output).toContain('Usage:');
      expect(output).toContain('Examples:');
      expect(output).toContain('Options:');
    });

    it('should return error for invalid command', () => {
      const output = helpSystem.showCommand('invalid-command');
      expect(output).toContain('Unknown command');
    });

    it('should include all command sections', () => {
      const output = helpSystem.showCommand('chat');
      expect(output).toContain('CHAT');
      expect(output).toContain('Description:');
      expect(output).toContain('Usage:');
      expect(output).toContain('Examples:');
      expect(output).toContain('Options:');
    });

    it('should display options with defaults', () => {
      const output = helpSystem.showCommand('query');
      expect(output).toContain('default:');
    });

    it('should display related commands', () => {
      const output = helpSystem.showCommand('query');
      expect(output).toContain('Related Commands:');
    });
  });

  describe('showComponent', () => {
    it('should display help for a valid component', () => {
      const output = helpSystem.showComponent('cascade-router');
      expect(output).toContain('cascade-router');
      expect(output).toContain('routing');
      expect(output).toContain('Description:');
      expect(output).toContain('Configuration:');
    });

    it('should return error for invalid component', () => {
      const output = helpSystem.showComponent('invalid-component');
      expect(output).toContain('Unknown component');
    });

    it('should display component configuration', () => {
      const output = helpSystem.showComponent('semantic-cache');
      expect(output).toContain('cache.enabled');
      expect(output).toContain('cache.size');
    });
  });

  describe('generateExamples', () => {
    it('should return examples for valid command', () => {
      const examples = helpSystem.generateExamples('query');
      expect(examples).toBeInstanceOf(Array);
      expect(examples.length).toBeGreaterThan(0);
      expect(examples[0]).toContain('aequor query');
    });

    it('should return empty array for invalid command', () => {
      const examples = helpSystem.generateExamples('invalid');
      expect(examples).toEqual([]);
    });
  });

  describe('showTroubleshooting', () => {
    it('should display troubleshooting tips for valid issue', () => {
      const output = helpSystem.showTroubleshooting('cache');
      expect(output).toContain('Troubleshooting: cache');
      expect(output).toContain('Symptoms:');
      expect(output).toContain('Solutions:');
    });

    it('should return error for unknown issue', () => {
      const output = helpSystem.showTroubleshooting('unknown-issue');
      expect(output).toContain('No troubleshooting tips found');
    });

    it('should include related topics', () => {
      const output = helpSystem.showTroubleshooting('cache');
      expect(output).toContain('Related:');
    });
  });

  describe('interactive', () => {
    it('should search commands', () => {
      const results = helpSystem.interactive('query');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('query');
    });

    it('should search components', () => {
      const results = helpSystem.interactive('router');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('router');
    });

    it('should search troubleshooting', () => {
      const results = helpSystem.interactive('network');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('Troubleshooting');
    });

    it('should return empty results for unknown query', () => {
      const results = helpSystem.interactive('xyzabc123');
      expect(results.length).toBe(0);
    });
  });

  describe('listCommands', () => {
    it('should list all commands', () => {
      const output = helpSystem.listCommands();
      expect(output).toContain('Available Commands');
      expect(output).toContain('query');
      expect(output).toContain('chat');
      expect(output).toContain('cache');
      expect(output).toContain('config');
    });

    it('should include command descriptions', () => {
      const output = helpSystem.listCommands();
      expect(output).toContain('Description');
    });
  });

  describe('listComponents', () => {
    it('should list all components grouped by type', () => {
      const output = helpSystem.listComponents();
      expect(output).toContain('Available Components');
      expect(output).toContain('ROUTING');
      expect(output).toContain('CACHE');
      expect(output).toContain('PRIVACY');
    });

    it('should include component descriptions', () => {
      const output = helpSystem.listComponents();
      expect(output).toContain('cascade-router');
    });
  });

  describe('showQuickStart', () => {
    it('should display quick start guide', () => {
      const output = helpSystem.showQuickStart();
      expect(output).toContain('Quick Start Guide');
      expect(output).toContain('First-Time Setup');
      expect(output).toContain('Run Your First Query');
      expect(output).toContain('Check Cache Performance');
    });

    it('should include example commands', () => {
      const output = helpSystem.showQuickStart();
      expect(output).toContain('aequor query');
      expect(output).toContain('aequor config');
      expect(output).toContain('aequor cache stats');
    });
  });
});
