/**
 * CLI Test Suite
 *
 * Tests for CLI commands and utilities.
 * Uses vitest for testing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentRegistry } from '@lsi/registry';
import { ComponentManager } from '@lsi/manager';
import { ConfigManager } from '@lsi/config';
import {
  pullCommand,
  pullMultiple,
  pullAll,
} from './commands/pull.js';
import {
  listCommand,
  listInstalledCommand,
  listUpdatesCommand,
} from './commands/list.js';
import { runCommand } from './commands/run.js';
import { infoCommand } from './commands/info.js';
import { updateCommand } from './commands/update.js';
import { removeCommand } from './commands/remove.js';
import { searchCommand } from './commands/search.js';
import {
  CliError,
  createComponentNotFoundError,
  handleCliError,
} from './utils/errors.js';
import { formatBytes, formatDuration } from './utils/progress.js';

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('@lsi/registry');
vi.mock('@lsi/manager');
vi.mock('@lsi/config');

// ============================================================================
// PULL COMMAND TESTS
// ============================================================================

describe('pull command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pull a component successfully', async () => {
    const mockRegistry = {
      initialize: vi.fn().mockResolvedValue(undefined),
      info: vi.fn().mockResolvedValue({
        name: 'test-component',
        latest_version: '1.0.0',
        installed: false,
      }),
      get: vi.fn().mockResolvedValue({
        name: 'test-component',
        version: '1.0.0',
        type: 'routing',
        download: {
          archive: {
            size_mb: 10,
          },
        },
      }),
      download: vi.fn().mockResolvedValue('/path/to/archive.tar.gz'),
      install: vi.fn().mockResolvedValue({
        name: 'test-component',
        version: '1.0.0',
        path: '/path/to/test-component',
        installed_at: new Date().toISOString(),
      }),
    };

    vi.mocked(ComponentRegistry).mockImplementation(() => mockRegistry as any);

    await expect(pullCommand('test-component')).resolves.not.toThrow();
  });

  it('should handle component not found error', async () => {
    const mockRegistry = {
      initialize: vi.fn().mockResolvedValue(undefined),
      info: vi.fn().mockRejectedValue(new Error('Component not found')),
      list: vi.fn().mockResolvedValue([
        { name: 'other-component' },
      ]),
    };

    vi.mocked(ComponentRegistry).mockImplementation(() => mockRegistry as any);

    await expect(pullCommand('test-component')).rejects.toThrow();
  });

  it('should force re-download with --force flag', async () => {
    const mockRegistry = {
      initialize: vi.fn().mockResolvedValue(undefined),
      info: vi.fn().mockResolvedValue({
        name: 'test-component',
        latest_version: '1.0.0',
        installed: true,
      }),
      get: vi.fn().mockResolvedValue({
        name: 'test-component',
        version: '1.0.0',
        type: 'routing',
      }),
      download: vi.fn().mockResolvedValue('/path/to/archive.tar.gz'),
      install: vi.fn().mockResolvedValue({
        name: 'test-component',
        version: '1.0.0',
        path: '/path/to/test-component',
        installed_at: new Date().toISOString(),
      }),
    };

    vi.mocked(ComponentRegistry).mockImplementation(() => mockRegistry as any);

    await pullCommand('test-component', { force: true });

    expect(mockRegistry.download).toHaveBeenCalled();
  });
});

// ============================================================================
// LIST COMMAND TESTS
// ============================================================================

describe('list command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list all components', async () => {
    const mockRegistry = {
      initialize: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([
        {
          name: 'component-1',
          latest_version: '1.0.0',
          type: 'routing',
          installed: true,
        },
        {
          name: 'component-2',
          latest_version: '2.0.0',
          type: 'cache',
          installed: false,
        },
      ]),
    };

    vi.mocked(ComponentRegistry).mockImplementation(() => mockRegistry as any);

    await expect(listCommand()).resolves.not.toThrow();
    expect(mockRegistry.list).toHaveBeenCalledWith({
      include_installed: true,
      type: undefined,
      stability: undefined,
    });
  });

  it('should filter by type', async () => {
    const mockRegistry = {
      initialize: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(ComponentRegistry).mockImplementation(() => mockRegistry as any);

    await listCommand({ type: 'routing' });

    expect(mockRegistry.list).toHaveBeenCalledWith({
      include_installed: true,
      type: 'routing',
      stability: undefined,
    });
  });

  it('should list only installed components', async () => {
    const mockRegistry = {
      initialize: vi.fn().mockResolvedValue(undefined),
      listInstalled: vi.fn().mockResolvedValue([
        {
          name: 'component-1',
          version: '1.0.0',
          type: 'routing',
        },
      ]),
    };

    vi.mocked(ComponentRegistry).mockImplementation(() => mockRegistry as any);

    await listInstalledCommand();

    expect(mockRegistry.listInstalled).toHaveBeenCalled();
  });
});

// ============================================================================
// RUN COMMAND TESTS
// ============================================================================

describe('run command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run an installed component', async () => {
    const mockManager = {
      initialize: vi.fn().mockResolvedValue(undefined),
      status: vi.fn().mockResolvedValue({
        name: 'test-component',
        version: '1.0.0',
        status: 'installed',
        path: '/path/to/component',
      }),
      run: vi.fn().mockResolvedValue({
        on: vi.fn(),
        kill: vi.fn(),
      }),
    };

    vi.mocked(ComponentManager).mockImplementation(() => mockManager as any);

    await expect(runCommand('test-component')).resolves.not.toThrow();
  });

  it('should fail if component not installed', async () => {
    const mockManager = {
      initialize: vi.fn().mockResolvedValue(undefined),
      status: vi.fn().mockResolvedValue({
        name: 'test-component',
        status: 'not-installed',
      }),
    };

    vi.mocked(ComponentManager).mockImplementation(() => mockManager as any);

    await expect(runCommand('test-component')).rejects.toThrow();
  });
});

// ============================================================================
// INFO COMMAND TESTS
// ============================================================================

describe('info command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show component information', async () => {
    const mockRegistry = {
      initialize: vi.fn().mockResolvedValue(undefined),
      info: vi.fn().mockResolvedValue({
        name: 'test-component',
        latest_version: '1.0.0',
        type: 'routing',
        description: 'Test component',
      }),
      get: vi.fn().mockResolvedValue({
        name: 'test-component',
        version: '1.0.0',
        type: 'routing',
        language: 'typescript',
        dependencies: [],
      }),
      listInstalled: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(ComponentRegistry).mockImplementation(() => mockRegistry as any);

    await expect(infoCommand('test-component')).resolves.not.toThrow();
  });
});

// ============================================================================
// UPDATE COMMAND TESTS
// ============================================================================

describe('update command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update component to latest version', async () => {
    const mockRegistry = {
      initialize: vi.fn().mockResolvedValue(undefined),
      listInstalled: vi.fn().mockResolvedValue([
        {
          name: 'test-component',
          version: '1.0.0',
        },
      ]),
      info: vi.fn().mockResolvedValue({
        name: 'test-component',
        latest_version: '2.0.0',
        update_available: true,
      }),
      update: vi.fn().mockResolvedValue({
        name: 'test-component',
        version: '2.0.0',
      }),
    };

    vi.mocked(ComponentRegistry).mockImplementation(() => mockRegistry as any);

    await expect(updateCommand('test-component')).resolves.not.toThrow();
  });

  it('should skip if already up to date', async () => {
    const mockRegistry = {
      initialize: vi.fn().mockResolvedValue(undefined),
      listInstalled: vi.fn().mockResolvedValue([
        {
          name: 'test-component',
          version: '1.0.0',
        },
      ]),
      info: vi.fn().mockResolvedValue({
        name: 'test-component',
        latest_version: '1.0.0',
        update_available: false,
      }),
    };

    vi.mocked(ComponentRegistry).mockImplementation(() => mockRegistry as any);

    await expect(updateCommand('test-component')).resolves.not.toThrow();
  });
});

// ============================================================================
// REMOVE COMMAND TESTS
// ============================================================================

describe('remove command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('inquirer', {
      prompt: vi.fn().mockResolvedValue({ confirm: true, proceed: true }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should remove installed component', async () => {
    const mockRegistry = {
      initialize: vi.fn().mockResolvedValue(undefined),
      listInstalled: vi.fn().mockResolvedValue([
        {
          name: 'test-component',
          version: '1.0.0',
        },
      ]),
      uninstall: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(ComponentRegistry).mockImplementation(() => mockRegistry as any);

    await expect(removeCommand('test-component', { force: true })).resolves.not.toThrow();
  });
});

// ============================================================================
// SEARCH COMMAND TESTS
// ============================================================================

describe('search command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should search for components', async () => {
    const mockRegistry = {
      initialize: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue([
        {
          name: 'cascade-router',
          score: 0.9,
          matched_fields: ['name'],
        },
      ]),
    };

    vi.mocked(ComponentRegistry).mockImplementation(() => mockRegistry as any);

    await expect(searchCommand('router')).resolves.not.toThrow();
  });

  it('should filter search results', async () => {
    const mockRegistry = {
      initialize: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockResolvedValue([]),
    };

    vi.mocked(ComponentRegistry).mockImplementation(() => mockRegistry as any);

    await searchCommand('router', { type: 'routing', limit: 10 });

    expect(mockRegistry.search).toHaveBeenCalledWith({
      query: 'router',
      type: 'routing',
      stability: undefined,
      category: undefined,
      limit: 10,
      offset: 0,
    });
  });
});

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

describe('error handling', () => {
  it('should create component not found error with suggestions', () => {
    const error = createComponentNotFoundError('test-component', [
      'test-component-v2',
      'other-component',
    ]);

    expect(error).toBeInstanceOf(CliError);
    expect(error.code).toBe('CLI_012');
    expect(error.suggestions.length).toBeGreaterThan(0);
  });

  it('should format error message correctly', () => {
    const error = new CliError({
      code: 'CLI_001' as any,
      message: 'Test error',
      severity: 'error',
      suggestions: [
        {
          text: 'Try this',
          command: 'aequor pull test',
        },
      ],
      exitCode: 1,
      showStackTrace: false,
    });

    const formatted = error.format(false);

    expect(formatted).toContain('Test error');
    expect(formatted).toContain('Suggestions:');
  });

  it('should include stack trace in debug mode', () => {
    const error = new CliError({
      code: 'CLI_001' as any,
      message: 'Test error',
      severity: 'error',
      suggestions: [],
      exitCode: 1,
      showStackTrace: true,
    });

    const errorWithStack = new Error('Test error');
    error.stack = errorWithStack.stack;

    const formatted = error.format(true);

    expect(formatted).toContain('Stack trace');
  });
});

// ============================================================================
// PROGRESS UTILITIES TESTS
// ============================================================================

describe('progress utilities', () => {
  it('should format bytes correctly', () => {
    expect(formatBytes(0)).toBe('0.00 B');
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
  });

  it('should format duration correctly', () => {
    expect(formatDuration(30)).toBe('30.0s');
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(3661)).toBe('1h 1m');
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('CLI integration tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pull, list, and run component', async () => {
    // This is a simplified integration test
    // In real implementation, would test full workflow

    const mockRegistry = {
      initialize: vi.fn().mockResolvedValue(undefined),
      info: vi.fn().mockResolvedValue({
        name: 'test-component',
        latest_version: '1.0.0',
        installed: false,
      }),
      get: vi.fn().mockResolvedValue({
        name: 'test-component',
        version: '1.0.0',
        type: 'routing',
      }),
      download: vi.fn().mockResolvedValue('/path/to/archive'),
      install: vi.fn().mockResolvedValue({
        name: 'test-component',
        version: '1.0.0',
        path: '/path/to/component',
        installed_at: new Date().toISOString(),
      }),
      list: vi.fn().mockResolvedValue([
        {
          name: 'test-component',
          latest_version: '1.0.0',
          type: 'routing',
          installed: true,
        },
      ]),
    };

    vi.mocked(ComponentRegistry).mockImplementation(() => mockRegistry as any);

    // Pull
    await pullCommand('test-component');
    expect(mockRegistry.install).toHaveBeenCalled();

    // List
    await listCommand();
    expect(mockRegistry.list).toHaveBeenCalled();
  });
});

// ============================================================================
// ERROR EXIT CODES
// ============================================================================

describe('exit codes', () => {
  it('should exit with code 1 for errors', () => {
    const error = new CliError({
      code: 'CLI_001' as any,
      message: 'Test error',
      severity: 'error',
      suggestions: [],
      exitCode: 1,
      showStackTrace: false,
    });

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    try {
      handleCliError(error, false);
    } catch (e) {
      // Expected
    }

    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  it('should exit with code 0 for warnings', () => {
    const error = new CliError({
      code: 'CLI_001' as any,
      message: 'Test warning',
      severity: 'warning',
      suggestions: [],
      exitCode: 0,
      showStackTrace: false,
    });

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    try {
      handleCliError(error, false);
    } catch (e) {
      // Expected
    }

    expect(exitSpy).toHaveBeenCalledWith(0);
    exitSpy.mockRestore();
  });
});
