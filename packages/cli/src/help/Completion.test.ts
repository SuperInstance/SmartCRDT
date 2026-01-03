/**
 * Tests for shell completion scripts
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Bash Completion', () => {
  const completionPath = join(process.cwd(), 'completion/bash/aequor.bash');
  let completionScript: string;

  beforeAll(() => {
    try {
      completionScript = readFileSync(completionPath, 'utf-8');
    } catch (error) {
      console.error('Could not read bash completion script');
    }
  });

  it('should define completion function', () => {
    expect(completionScript).toContain('_aequor_completion()');
    expect(completionScript).toContain('complete -F _aequor_completion aequor');
  });

  it('should include all main commands', () => {
    expect(completionScript).toContain('query');
    expect(completionScript).toContain('chat');
    expect(completionScript).toContain('cache');
    expect(completionScript).toContain('config');
    expect(completionScript).toContain('status');
  });

  it('should handle subcommands', () => {
    expect(completionScript).toContain('cache_commands=');
    expect(completionScript).toContain('cartridge_commands=');
    expect(completionScript).toContain('training_commands=');
  });

  it('should handle options', () => {
    expect(completionScript).toContain('--backend');
    expect(completionScript).toContain('--format');
    expect(completionScript).toContain('--help');
  });

  it('should handle file completion', () => {
    expect(completionScript).toContain('compgen -f');
  });
});

describe('Zsh Completion', () => {
  const completionPath = join(process.cwd(), 'completion/zsh/_aequor');
  let completionScript: string;

  beforeAll(() => {
    try {
      completionScript = readFileSync(completionPath, 'utf-8');
    } catch (error) {
      console.error('Could not read zsh completion script');
    }
  });

  it('should define completion function', () => {
    expect(completionScript).toContain('#compdef aequor');
    expect(completionScript).toContain('_aequor(');
  });

  it('should include all main commands with descriptions', () => {
    expect(completionScript).toContain("'query:Execute a query");
    expect(completionScript).toContain("'chat:Start interactive chat");
    expect(completionScript).toContain("'cache:Manage semantic cache");
  });

  it('should include subcommands', () => {
    expect(completionScript).toContain('cache_commands=');
    expect(completionScript).toContain('cartridge_commands=');
    expect(completionScript).toContain('training_commands=');
  });

  it('should handle options with descriptions', () => {
    expect(completionScript).toContain("'(-b --backend)'{-b,--backend}");
    expect(completionScript).toContain("'(-h --help)'{-h,--help}");
  });

  it('should use _describe for completions', () => {
    expect(completionScript).toContain('_describe -t commands');
    expect(completionScript).toContain('_describe -t subcommands');
  });
});

describe('PowerShell Completion', () => {
  const completionPath = join(process.cwd(), 'completion/powershell/aequor.ps1');
  let completionScript: string;

  beforeAll(() => {
    try {
      completionScript = readFileSync(completionPath, 'utf-8');
    } catch (error) {
      console.error('Could not read PowerShell completion script');
    }
  });

  it('should define script block', () => {
    expect(completionScript).toContain('$script:block =');
    expect(completionScript).toContain('Register-ArgumentCompleter');
  });

  it('should include all main commands', () => {
    expect(completionScript).toContain("'query'");
    expect(completionScript).toContain("'chat'");
    expect(completionScript).toContain("'cache'");
  });

  it('should handle subcommands', () => {
    expect(completionScript).toContain('$cacheCommands');
    expect(completionScript).toContain('$cartridgeCommands');
    expect(completionScript).toContain('$trainingCommands');
  });

  it('should create CompletionResult objects', () => {
    expect(completionScript).toContain('[CompletionResult]::new');
  });

  it('should handle file completion', () => {
    expect(completionScript).toContain('Complete-File');
  });
});

describe('Completion Integration', () => {
  it('should have consistent commands across all shells', () => {
    const bashPath = join(process.cwd(), 'completion/bash/aequor.bash');
    const zshPath = join(process.cwd(), 'completion/zsh/_aequor');
    const psPath = join(process.cwd(), 'completion/powershell/aequor.ps1');

    const bashScript = readFileSync(bashPath, 'utf-8');
    const zshScript = readFileSync(zshPath, 'utf-8');
    const psScript = readFileSync(psPath, 'utf-8');

    // Check for core commands in all scripts
    const coreCommands = ['query', 'chat', 'cache', 'config', 'status'];

    coreCommands.forEach((cmd) => {
      expect(bashScript).toContain(cmd);
      expect(zshScript).toContain(cmd);
      expect(psScript).toContain(`'${cmd}'`);
    });
  });

  it('should have consistent subcommands across all shells', () => {
    const bashScript = readFileSync(join(process.cwd(), 'completion/bash/aequor.bash'), 'utf-8');
    const zshScript = readFileSync(join(process.cwd(), 'completion/zsh/_aequor'), 'utf-8');

    // Check cache subcommands
    expect(bashScript).toContain('cache_commands=');
    expect(zshScript).toContain('cache_commands=');
  });
});

describe('Installation Script', () => {
  const installScriptPath = join(process.cwd(), 'completion/install.sh');
  let installScript: string;

  beforeAll(() => {
    try {
      installScript = readFileSync(installScriptPath, 'utf-8');
    } catch (error) {
      console.error('Could not read installation script');
    }
  });

  it('should be executable bash script', () => {
    expect(installScript).toContain('#!/bin/bash');
    expect(installScript).toContain('set -e');
  });

  it('should provide installation options', () => {
    expect(installScript).toContain('install_bash()');
    expect(installScript).toContain('install_zsh()');
    expect(installScript).toContain('install_bash_system()');
    expect(installScript).toContain('install_zsh_system()');
  });

  it('should provide uninstall function', () => {
    expect(installScript).toContain('uninstall()');
  });

  it('should provide help function', () => {
    expect(installScript).toContain('show_help()');
  });

  it('should handle shell detection', () => {
    expect(installScript).toContain('detect_shell()');
  });
});

describe('Completion README', () => {
  const readmePath = join(process.cwd(), 'completion/README.md');
  let readme: string;

  beforeAll(() => {
    try {
      readme = readFileSync(readmePath, 'utf-8');
    } catch (error) {
      console.error('Could not read completion README');
    }
  });

  it('should document installation', () => {
    expect(readme).toContain('Installation');
    expect(readme).toContain('Quick Install');
    expect(readme).toContain('Manual Installation');
  });

  it('should document supported shells', () => {
    expect(readme).toContain('Bash');
    expect(readme).toContain('Zsh');
    expect(readme).toContain('PowerShell');
  });

  it('should document usage', () => {
    expect(readme).toContain('Usage');
    expect(readme).toContain('TAB');
  });

  it('should document troubleshooting', () => {
    expect(readme).toContain('Troubleshooting');
  });
});
