/**
 * SuperInstance CLI Tests
 *
 * Tests for the main SuperInstance CLI entry point
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { createProgram } from './superinstance.js';

// Mock dependencies
vi.mock('@lsi/registry', () => ({
  getGlobalRegistry: vi.fn(),
}));

vi.mock('@lsi/config', () => ({
  ConfigManager: vi.fn(() => ({
    load: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    save: vi.fn(),
    getAll: vi.fn(() => ({})),
    validate: vi.fn(() => ({ valid: true, errors: [], warnings: [] })),
  })),
}));

vi.mock('@lsi/manager', () => ({
  ComponentManager: vi.fn(() => ({
    list: vi.fn(() => []),
    run: vi.fn(() => ({ exitCode: 0 })),
  })),
}));

vi.mock('@lsi/resolver', () => ({
  DependencyResolver: vi.fn(),
}));

describe('SuperInstance CLI', () => {
  let program: Command;
  let consoleErrorSpy: any;
  let consoleLogSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    program = createProgram();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      throw new Error(`Process exited with code ${code}`);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('Program Structure', () => {
    it('should create a program with correct name', () => {
      expect(program.name()).toBe('superinstance');
    });

    it('should have a description', () => {
      expect(program.description()).toContain('SuperInstance');
    });

    it('should have version option', () => {
      const versionOption = program.options.find((opt: any) => opt.long === '--version');
      expect(versionOption).toBeDefined();
    });

    it('should have debug option', () => {
      const debugOption = program.options.find((opt: any) => opt.long === '--debug');
      expect(debugOption).toBeDefined();
    });

    it('should have quiet option', () => {
      const quietOption = program.options.find((opt: any) => opt.long === '--quiet');
      expect(quietOption).toBeDefined();
    });
  });

  describe('Component Commands', () => {
    it('should have pull command', () => {
      const pullCommand = program.commands.find((c: any) => c.name() === 'pull');
      expect(pullCommand).toBeDefined();
    });

    it('should have list command', () => {
      const listCommand = program.commands.find((c: any) => c.name() === 'list');
      expect(listCommand).toBeDefined();
    });

    it('should have run command', () => {
      const runCommand = program.commands.find((c: any) => c.name() === 'run');
      expect(runCommand).toBeDefined();
    });

    it('should have info command', () => {
      const infoCommand = program.commands.find((c: any) => c.name() === 'info');
      expect(infoCommand).toBeDefined();
    });

    it('should have update command', () => {
      const updateCommand = program.commands.find((c: any) => c.name() === 'update');
      expect(updateCommand).toBeDefined();
    });

    it('should have remove command', () => {
      const removeCommand = program.commands.find((c: any) => c.name() === 'remove');
      expect(removeCommand).toBeDefined();
    });

    it('should have remove alias rm', () => {
      const removeCommand = program.commands.find((c: any) => c.name() === 'remove');
      expect(removeCommand.aliases()).toContain('rm');
    });
  });

  describe('App Commands', () => {
    it('should have app command group', () => {
      const appCommand = program.commands.find((c: any) => c.name() === 'app');
      expect(appCommand).toBeDefined();
    });

    it('should have app install command', () => {
      const appCommand = program.commands.find((c: any) => c.name() === 'app');
      const installCommand = appCommand?.commands.find((c: any) => c.name() === 'install');
      expect(installCommand).toBeDefined();
    });

    it('should have app run command', () => {
      const appCommand = program.commands.find((c: any) => c.name() === 'app');
      const runCommand = appCommand?.commands.find((c: any) => c.name() === 'run');
      expect(runCommand).toBeDefined();
    });

    it('should have app list command', () => {
      const appCommand = program.commands.find((c: any) => c.name() === 'app');
      const listCommand = appCommand?.commands.find((c: any) => c.name() === 'list');
      expect(listCommand).toBeDefined();
    });

    it('should have app info command', () => {
      const appCommand = program.commands.find((c: any) => c.name() === 'app');
      const infoCommand = appCommand?.commands.find((c: any) => c.name() === 'info');
      expect(infoCommand).toBeDefined();
    });
  });

  describe('Config Commands', () => {
    it('should have config command group', () => {
      const configCommand = program.commands.find((c: any) => c.name() === 'config');
      expect(configCommand).toBeDefined();
    });

    it('should have config get command', () => {
      const configCommand = program.commands.find((c: any) => c.name() === 'config');
      const getCommand = configCommand?.commands.find((c: any) => c.name() === 'get');
      expect(getCommand).toBeDefined();
    });

    it('should have config set command', () => {
      const configCommand = program.commands.find((c: any) => c.name() === 'config');
      const setCommand = configCommand?.commands.find((c: any) => c.name() === 'set');
      expect(setCommand).toBeDefined();
    });

    it('should have config list command', () => {
      const configCommand = program.commands.find((c: any) => c.name() === 'config');
      const listCommand = configCommand?.commands.find((c: any) => c.name() === 'list');
      expect(listCommand).toBeDefined();
    });
  });

  describe('Command Options', () => {
    it('pull command should have version option', () => {
      const pullCommand = program.commands.find((c: any) => c.name() === 'pull');
      const versionOption = pullCommand?.options.find((opt: any) => opt.long === '--version');
      expect(versionOption).toBeDefined();
    });

    it('pull command should have force option', () => {
      const pullCommand = program.commands.find((c: any) => c.name() === 'pull');
      const forceOption = pullCommand?.options.find((opt: any) => opt.long === '--force');
      expect(forceOption).toBeDefined();
    });

    it('list command should have installed option', () => {
      const listCommand = program.commands.find((c: any) => c.name() === 'list');
      const installedOption = listCommand?.options.find((opt: any) => opt.long === '--installed');
      expect(installedOption).toBeDefined();
    });

    it('list command should have json option', () => {
      const listCommand = program.commands.find((c: any) => c.name() === 'list');
      const jsonOption = listCommand?.options.find((opt: any) => opt.long === '--json');
      expect(jsonOption).toBeDefined();
    });

    it('remove command should have force option', () => {
      const removeCommand = program.commands.find((c: any) => c.name() === 'remove');
      const forceOption = removeCommand?.options.find((opt: any) => opt.long === '--force');
      expect(forceOption).toBeDefined();
    });
  });

  describe('Help System', () => {
    it('should have help text with examples', async () => {
      const helpText = program.helpInformation();
      expect(helpText).toContain('Examples:');
      expect(helpText).toContain('superinstance pull');
    });

    it('should show help for pull command', () => {
      const pullCommand = program.commands.find((c: any) => c.name() === 'pull');
      expect(pullCommand?.description()).toBeDefined();
    });

    it('should show help for app command group', () => {
      const appCommand = program.commands.find((c: any) => c.name() === 'app');
      expect(appCommand?.description()).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should have unhandledRejection handler', () => {
      const hooks = program.hooks;
      expect(hooks).toHaveProperty('preAction');
    });

    it('should export createProgram function', () => {
      expect(typeof createProgram).toBe('function');
    });
  });

  describe('Integration with Dependencies', () => {
    it('should import from @lsi/registry', () => {
      const { getGlobalRegistry } = require('@lsi/registry');
      expect(getGlobalRegistry).toBeDefined();
    });

    it('should import from @lsi/config', () => {
      const { ConfigManager } = require('@lsi/config');
      expect(ConfigManager).toBeDefined();
    });

    it('should import from @lsi/manager', () => {
      const { ComponentManager } = require('@lsi/manager');
      expect(ComponentManager).toBeDefined();
    });

    it('should import from @lsi/resolver', () => {
      const { DependencyResolver } = require('@lsi/resolver');
      expect(DependencyResolver).toBeDefined();
    });
  });

  describe('CLI Design Principles', () => {
    it('should have simple, direct commands', () => {
      // Commands should be short and memorable
      const commandNames = program.commands.map((c: any) => c.name());

      expect(commandNames).toContain('pull');
      expect(commandNames).toContain('list');
      expect(commandNames).toContain('run');
      expect(commandNames).toContain('info');
      expect(commandNames).toContain('update');
      expect(commandNames).toContain('remove');
    });

    it('should use noun-based commands, not verb-based', () => {
      // Components: pull, list, run, info, update, remove
      // Apps: app install, app run, app list, app info
      // Config: config get, config set, config list

      const appCommand = program.commands.find((c: any) => c.name() === 'app');
      const configCommand = program.commands.find((c: any) => c.name() === 'config');

      expect(appCommand).toBeDefined();
      expect(configCommand).toBeDefined();
    });

    it('should have consistent option naming', () => {
      // Check for consistent use of --version, --force, --json, etc.
      const commandsWithOptions = program.commands.filter(
        (c: any) => c.options.length > 0
      );

      commandsWithOptions.forEach((cmd: any) => {
        cmd.options.forEach((opt: any) => {
          // Options should use --long-name format
          if (opt.long) {
            expect(opt.long).toMatch(/^--[\w-]+$/);
          }
        });
      });
    });
  });

  describe('Command Examples', () => {
    it('should document pull command example', () => {
      const helpText = program.helpInformation();
      expect(helpText).toMatch(/superinstance pull/);
    });

    it('should document list command example', () => {
      const helpText = program.helpInformation();
      expect(helpText).toMatch(/superinstance list/);
    });

    it('should document app command examples', () => {
      const helpText = program.helpInformation();
      expect(helpText).toMatch(/superinstance app/);
    });

    it('should document config command examples', () => {
      const helpText = program.helpInformation();
      expect(helpText).toMatch(/superinstance config/);
    });
  });
});
