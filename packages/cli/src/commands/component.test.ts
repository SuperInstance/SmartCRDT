/**
 * Component Command Tests
 *
 * Comprehensive tests for component management commands:
 * - pull, list, run, info, update, remove
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { componentCommand, componentCommands, componentPullMultiple, componentUpdateAll } from './component';
import { pullCommand, pullMultiple } from './pull';
import { listCommand, listInstalledCommand } from './list';
import { runCommand, runInteractive } from './run';
import { infoCommand, infoVerifyCommand } from './info';
import { updateCommand, checkUpdatesCommand, rollbackCommand } from './update';
import { removeCommand, cleanCommand, purgeCommand } from './remove';
import { ComponentRegistry } from '@lsi/registry';
import { ConfigManager } from '@lsi/config';
import chalk from 'chalk';

// Mock dependencies
vi.mock('@lsi/registry');
vi.mock('@lsi/config');
vi.mock('./pull');
vi.mock('./list');
vi.mock('./run');
vi.mock('./info');
vi.mock('./update');
vi.mock('./remove');

describe('Component Command', () => {
  let mockConsole: {
    log: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    mockConsole = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    mockConsole.log.mockRestore();
    mockConsole.error.mockRestore();
    vi.clearAllMocks();
  });

  describe('componentCommand - Routing', () => {
    it('should route pull command', async () => {
      vi.mocked(pullCommand).mockResolvedValue(undefined);

      await componentCommand('pull', ['router'], {});

      expect(pullCommand).toHaveBeenCalledWith('router', expect.any(Object));
    });

    it('should route list command', async () => {
      vi.mocked(listCommand).mockResolvedValue(undefined);

      await componentCommand('list', [], {});

      expect(listCommand).toHaveBeenCalledWith(expect.any(Object));
    });

    it('should route run command', async () => {
      vi.mocked(runCommand).mockResolvedValue(0);

      await componentCommand('run', ['cache'], {});

      expect(runCommand).toHaveBeenCalledWith('cache', expect.any(Object));
    });

    it('should route info command', async () => {
      vi.mocked(infoCommand).mockResolvedValue(undefined);

      await componentCommand('info', ['router'], {});

      expect(infoCommand).toHaveBeenCalledWith('router', expect.any(Object));
    });

    it('should route update command', async () => {
      vi.mocked(updateCommand).mockResolvedValue(undefined);

      await componentCommand('update', ['router'], {});

      expect(updateCommand).toHaveBeenCalledWith('router', expect.any(Object));
    });

    it('should route remove command', async () => {
      vi.mocked(removeCommand).mockResolvedValue(undefined);

      await componentCommand('remove', ['old-router'], {});

      expect(removeCommand).toHaveBeenCalledWith('old-router', expect.any(Object));
    });

    it('should show help for unknown command', async () => {
      await componentCommand('unknown' as any, [], {});

      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('SuperInstance Component Management'));
    });
  });

  describe('pull command routing', () => {
    it('should require component name for pull', async () => {
      await componentCommand('pull', [], {});

      expect(mockConsole.error).toHaveBeenCalledWith(
        chalk.red('Error: Component name is required')
      );
      expect(mockConsole.log).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
    });

    it('should pass options to pull command', async () => {
      vi.mocked(pullCommand).mockResolvedValue(undefined);

      await componentCommand('pull', ['router', '--version', '1.2.0', '--force'], {
        version: '1.2.0',
        force: true,
      });

      expect(pullCommand).toHaveBeenCalledWith('router', {
        version: '1.2.0',
        force: true,
        skipDependencies: undefined,
        dryRun: undefined,
        debug: undefined,
      });
    });

    it('should support --dry-run flag', async () => {
      vi.mocked(pullCommand).mockResolvedValue(undefined);

      await componentCommand('pull', ['router'], { dryRun: true });

      expect(pullCommand).toHaveBeenCalledWith('router', expect.objectContaining({
        dryRun: true,
      }));
    });
  });

  describe('list command routing', () => {
    it('should call listCommand by default', async () => {
      vi.mocked(listCommand).mockResolvedValue(undefined);

      await componentCommand('list', [], {});

      expect(listCommand).toHaveBeenCalledWith(expect.objectContaining({
        format: 'table',
      }));
    });

    it('should call listInstalledCommand with --installed', async () => {
      vi.mocked(listInstalledCommand).mockResolvedValue(undefined);

      await componentCommand('list', [], { installed: true });

      expect(listInstalledCommand).toHaveBeenCalled();
    });

    it('should support format option', async () => {
      vi.mocked(listCommand).mockResolvedValue(undefined);

      await componentCommand('list', [], { format: 'json' });

      expect(listCommand).toHaveBeenCalledWith(expect.objectContaining({
        format: 'json',
      }));
    });
  });

  describe('run command routing', () => {
    it('should require component name for run', async () => {
      await componentCommand('run', [], {});

      expect(mockConsole.error).toHaveBeenCalledWith(
        chalk.red('Error: Component name is required')
      );
    });

    it('should pass arguments to run command', async () => {
      vi.mocked(runCommand).mockResolvedValue(0);

      await componentCommand('run', ['cache', '--port', '6379'], {});

      expect(runCommand).toHaveBeenCalledWith('cache', expect.objectContaining({
        args: ['--port', '6379'],
      }));
    });

    it('should use interactive mode with --interactive flag', async () => {
      vi.mocked(runInteractive).mockResolvedValue(0);

      await componentCommand('run', ['cache'], { interactive: true });

      expect(runInteractive).toHaveBeenCalledWith('cache', expect.any(Object));
    });

    it('should exit with run command exit code', async () => {
      vi.mocked(runCommand).mockResolvedValue(42);

      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      await expect(componentCommand('run', ['cache'], {})).rejects.toThrow('process.exit called');
      expect(exitSpy).toHaveBeenCalledWith(42);

      exitSpy.mockRestore();
    });
  });

  describe('info command routing', () => {
    it('should require component name for info', async () => {
      await componentCommand('info', [], {});

      expect(mockConsole.error).toHaveBeenCalledWith(
        chalk.red('Error: Component name is required')
      );
    });

    it('should pass options to info command', async () => {
      vi.mocked(infoCommand).mockResolvedValue(undefined);

      await componentCommand('info', ['router'], { verbose: true, allVersions: true });

      expect(infoCommand).toHaveBeenCalledWith('router', expect.objectContaining({
        verbose: true,
        allVersions: true,
      }));
    });

    it('should call infoVerifyCommand with --verify flag', async () => {
      vi.mocked(infoVerifyCommand).mockResolvedValue(undefined);

      await componentCommand('info', ['router'], { verify: true });

      expect(infoVerifyCommand).toHaveBeenCalledWith('router');
    });

    it('should support --all-versions flag', async () => {
      vi.mocked(infoCommand).mockResolvedValue(undefined);

      await componentCommand('info', ['router'], { allVersions: true });

      expect(infoCommand).toHaveBeenCalledWith('router', expect.objectContaining({
        allVersions: true,
      }));
    });
  });

  describe('update command routing', () => {
    it('should require component name or --all flag', async () => {
      await componentCommand('update', [], {});

      expect(mockConsole.error).toHaveBeenCalledWith(
        chalk.red('Error: Component name or --all is required')
      );
    });

    it('should pass name to update command', async () => {
      vi.mocked(updateCommand).mockResolvedValue(undefined);

      await componentCommand('update', ['router'], {});

      expect(updateCommand).toHaveBeenCalledWith('router', expect.any(Object));
    });

    it('should call updateCommand with --all flag', async () => {
      vi.mocked(updateCommand).mockResolvedValue(undefined);

      await componentCommand('update', [], { all: true });

      expect(updateCommand).toHaveBeenCalledWith(undefined, expect.objectContaining({
        all: true,
      }));
    });

    it('should call checkUpdatesCommand with --check flag', async () => {
      vi.mocked(checkUpdatesCommand).mockResolvedValue(undefined);

      await componentCommand('update', ['router'], { check: true });

      expect(checkUpdatesCommand).toHaveBeenCalledWith('router');
    });

    it('should call rollbackCommand with --rollback flag', async () => {
      vi.mocked(rollbackCommand).mockResolvedValue(undefined);

      await componentCommand('update', ['router'], { rollback: true });

      expect(rollbackCommand).toHaveBeenCalledWith('router', undefined);
    });

    it('should pass version to rollbackCommand', async () => {
      vi.mocked(rollbackCommand).mockResolvedValue(undefined);

      await componentCommand('update', ['router'], { rollback: '1.0.0' });

      expect(rollbackCommand).toHaveBeenCalledWith('router', '1.0.0');
    });
  });

  describe('remove command routing', () => {
    it('should require component name for remove', async () => {
      await componentCommand('remove', [], {});

      expect(mockConsole.error).toHaveBeenCalledWith(
        chalk.red('Error: Component name is required')
      );
    });

    it('should pass options to remove command', async () => {
      vi.mocked(removeCommand).mockResolvedValue(undefined);

      await componentCommand('remove', ['old-router'], { force: true, purge: true });

      expect(removeCommand).toHaveBeenCalledWith('old-router', expect.objectContaining({
        force: true,
        purge: true,
      }));
    });

    it('should support --skip-deps flag', async () => {
      vi.mocked(removeCommand).mockResolvedValue(undefined);

      await componentCommand('remove', ['old-router'], { skipDependencies: true });

      expect(removeCommand).toHaveBeenCalledWith('old-router', expect.objectContaining({
        skipDependencies: true,
      }));
    });
  });

  describe('componentCommands export', () => {
    it('should export command definitions', () => {
      expect(componentCommands).toBeDefined();
      expect(componentCommands.pull).toBeDefined();
      expect(componentCommands.list).toBeDefined();
      expect(componentCommands.run).toBeDefined();
      expect(componentCommands.info).toBeDefined();
      expect(componentCommands.update).toBeDefined();
      expect(componentCommands.remove).toBeDefined();
    });

    it('should have command metadata', () => {
      expect(componentCommands.pull.description).toBeDefined();
      expect(componentCommands.pull.handler).toBeDefined();
      expect(componentCommands.pull.examples).toBeInstanceOf(Array);
    });
  });

  describe('componentPullMultiple', () => {
    it('should call pullMultiple with names', async () => {
      vi.mocked(pullMultiple).mockResolvedValue(undefined);

      await componentPullMultiple(['router', 'cache'], {});

      expect(pullMultiple).toHaveBeenCalledWith(['router', 'cache'], {});
    });
  });

  describe('componentUpdateAll', () => {
    it('should call update with all flag', async () => {
      vi.mocked(updateCommand).mockResolvedValue(undefined);

      await componentUpdateAll({ force: true });

      expect(updateCommand).toHaveBeenCalledWith(undefined, expect.objectContaining({
        all: true,
        force: true,
      }));
    });
  });
});

describe('Component Command Integration', () => {
  describe('Error Handling', () => {
    it('should handle pull command errors gracefully', async () => {
      vi.mocked(pullCommand).mockRejectedValue(new Error('Network error'));

      await expect(componentCommand('pull', ['router'], {})).rejects.toThrow('Network error');
    });

    it('should handle run command errors gracefully', async () => {
      vi.mocked(runCommand).mockRejectedValue(new Error('Component not found'));

      await expect(componentCommand('run', ['cache'], {})).rejects.toThrow('Component not found');
    });

    it('should handle update command errors gracefully', async () => {
      vi.mocked(updateCommand).mockRejectedValue(new Error('No updates available'));

      await expect(componentCommand('update', ['router'], {})).rejects.toThrow('No updates available');
    });
  });

  describe('Option Parsing', () => {
    it('should parse --version option correctly', async () => {
      vi.mocked(pullCommand).mockResolvedValue(undefined);

      await componentCommand('pull', ['router'], { version: '1.2.3' });

      expect(pullCommand).toHaveBeenCalledWith('router', expect.objectContaining({
        version: '1.2.3',
      }));
    });

    it('should parse --force option correctly', async () => {
      vi.mocked(updateCommand).mockResolvedValue(undefined);

      await componentCommand('update', ['router'], { force: true });

      expect(updateCommand).toHaveBeenCalledWith('router', expect.objectContaining({
        force: true,
      }));
    });

    it('should parse --dry-run option correctly', async () => {
      vi.mocked(pullCommand).mockResolvedValue(undefined);

      await componentCommand('pull', ['router'], { dryRun: true });

      expect(pullCommand).toHaveBeenCalledWith('router', expect.objectContaining({
        dryRun: true,
      }));
    });
  });

  describe('Command Examples', () => {
    it('should provide examples for pull command', () => {
      const examples = componentCommands.pull.examples;

      expect(examples).toContain('superinstance component pull router');
      expect(examples).toContain('superinstance component pull router --version 1.2.0');
    });

    it('should provide examples for list command', () => {
      const examples = componentCommands.list.examples;

      expect(examples).toContain('superinstance component list');
      expect(examples).toContain('superinstance component list --installed');
    });

    it('should provide examples for run command', () => {
      const examples = componentCommands.run.examples;

      expect(examples).toContain('superinstance component run cache');
      expect(examples).toContain('superinstance component run router --port 8080');
    });
  });
});

describe('Component Command Edge Cases', () => {
  it('should handle empty component name gracefully', async () => {
    await componentCommand('pull', [''], {});

    expect(mockConsole.error).toHaveBeenCalled();
  });

  it('should handle special characters in component name', async () => {
    vi.mocked(pullCommand).mockResolvedValue(undefined);

    await componentCommand('pull', ['@scope/router'], {});

    expect(pullCommand).toHaveBeenCalledWith('@scope/router', expect.any(Object));
  });

  it('should handle multiple arguments in run command', async () => {
    vi.mocked(runCommand).mockResolvedValue(0);

    await componentCommand('run', ['cache', '--port', '6379', '--verbose'], {});

    expect(runCommand).toHaveBeenCalledWith('cache', expect.objectContaining({
      args: ['--port', '6379', '--verbose'],
    }));
  });

  it('should handle concurrent pull operations', async () => {
    vi.mocked(pullMultiple).mockResolvedValue(undefined);

    await Promise.all([
      componentPullMultiple(['router', 'cache'], {}),
      componentPullMultiple(['embeddings', 'privacy'], {}),
    ]);

    expect(pullMultiple).toHaveBeenCalledTimes(2);
  });
});
