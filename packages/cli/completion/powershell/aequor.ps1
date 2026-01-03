# PowerShell completion for Aequor CLI
# To enable, add this to your PowerShell profile:
#   . /path/to/aequor.ps1
#
# Or install system-wide:
#   Copy to C:\Program Files\PowerShell\7\Modules\AequorCompletion

using namespace System.Management.Automation
using namespace System.Management.Automation.Language

$script:block = {
    param($wordToComplete, $commandAst, $cursorPosition)

    # Main commands
    $commands = @(
        'query'
        'chat'
        'status'
        'cache'
        'cartridge'
        'training'
        'system'
        'privacy'
        'config'
        'models'
        'cost'
        'test'
        'export'
        'import'
        'help'
        'examples'
        'quickstart'
        'version'
    )

    # Cache subcommands
    $cacheCommands = @('stats', 'clear', 'warm', 'invalidate')

    # Cartridge subcommands
    $cartridgeCommands = @('list', 'install', 'load', 'unload', 'create', 'export')

    # Training subcommands
    $trainingCommands = @('shadow', 'train', 'deploy', 'rollback', 'ab-test')

    # System subcommands
    $systemCommands = @('info', 'health', 'metrics')

    # Privacy subcommands
    $privacyCommands = @('classify', 'redact', 'encode', 'audit')

    # Config options
    $configOptions = @('--list', '--get', '--set', '--reset', '--global', '--local')
    $configKeys = @(
        'cache.enabled'
        'cache.size'
        'cache.ttl'
        'privacy.epsilon'
        'privacy.enabled'
        'router.backend'
        'router.threshold'
        'models.local'
        'models.cloud'
    )

    # Query options
    $queryBackends = @('local', 'cloud', 'auto')
    $queryFormats = @('text', 'json')

    # Model backends
    $modelBackends = @('local', 'cloud')

    # Cost periods
    $costPeriods = @('today', 'week', 'month', 'all')

    # Test types
    $testTypes = @('unit', 'integration', 'e2e', 'performance')

    # Export formats
    $exportFormats = @('json', 'jsonl', 'cartridge')

    # Export types
    $exportTypes = @('all', 'knowledge', 'cache', 'history', 'training')

    # Import modes
    $importModes = @('merge', 'replace')

    # Import types
    $importTypes = @('all', 'knowledge', 'cache', 'history', 'training')

    # Parse command elements
    $commandElements = $commandAst.CommandElements
    $elementCount = $commandElements.Count

    # Complete main commands
    if ($elementCount -eq 1) {
        $commands | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
            [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Aequor command: $_")
        }
        return
    }

    # Get the command
    $command = $commandElements[0].Value
    $prevElement = if ($elementCount -gt 1) { $commandElements[$elementCount - 2].Value } else { '' }

    # Complete based on command
    switch ($command) {
        'cache' {
            if ($elementCount -eq 2) {
                $cacheCommands | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                    [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Cache subcommand: $_")
                }
            }
        }

        'cartridge' {
            if ($elementCount -eq 2) {
                $cartridgeCommands | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                    [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Cartridge subcommand: $_")
                }
            } elseif ($elementCount -eq 3) {
                $subcommand = $commandElements[1].Value
                if ($subcommand -in @('install', 'create', 'export')) {
                    # Complete file paths
                    Complete-File -WordToComplete $wordToComplete
                } elseif ($subcommand -in @('load', 'unload')) {
                    # Complete cartridge names
                    & aequor cartridge list --quiet 2>$null | ForEach-Object {
                        if ($_ -like "$wordToComplete*") {
                            [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Cartridge: $_")
                        }
                    }
                }
            }
        }

        'training' {
            if ($elementCount -eq 2) {
                $trainingCommands | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                    [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Training subcommand: $_")
                }
            } elseif ($elementCount -eq 3) {
                $subcommand = $commandElements[1].Value
                if ($subcommand -in @('deploy', 'ab-test')) {
                    Complete-File -WordToComplete $wordToComplete
                }
            }
        }

        'system' {
            if ($elementCount -eq 2) {
                $systemCommands | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                    [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "System subcommand: $_")
                }
            }
        }

        'privacy' {
            if ($elementCount -eq 2) {
                $privacyCommands | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                    [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Privacy subcommand: $_")
                }
            }
        }

        'config' {
            if ($elementCount -eq 2) {
                $configOptions | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                    [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Config option: $_")
                }
            } elseif ($elementCount -eq 3 -and $prevElement -in @('--get', '--set')) {
                $configKeys | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                    [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Config key: $_")
                }
            }
        }

        'query' {
            if ($prevElement -in @('--backend', '-b')) {
                $queryBackends | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                    [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Backend: $_")
                }
            } elseif ($prevElement -in @('--format', '-f')) {
                $queryFormats | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                    [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Format: $_")
                }
            } elseif ($prevElement -in @('--model', '-m')) {
                # Complete model names
                & aequor models list --quiet 2>$null | ForEach-Object {
                    if ($_ -like "$wordToComplete*") {
                        [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Model: $_")
                    }
                }
            } elseif ($wordToComplete -like '-*') {
                # Complete options
                @('-t', '--trace', '-b', '--backend', '-m', '--model', '-f', '--format', '--no-cache', '-v', '--verbose', '-h', '--help') | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                    [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Option: $_")
                }
            }
        }

        'chat' {
            if ($prevElement -in @('--backend', '-b')) {
                $queryBackends | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                    [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Backend: $_")
                }
            } elseif ($prevElement -in @('--model', '-m')) {
                & aequor models list --quiet 2>$null | ForEach-Object {
                    if ($_ -like "$wordToComplete*") {
                        [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Model: $_")
                    }
                }
            } elseif ($prevElement -eq '--history') {
                Complete-File -WordToComplete $wordToComplete
            } elseif ($wordToComplete -like '-*') {
                @('-b', '--backend', '-m', '--model', '--no-cache', '--history', '-h', '--help') | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                    [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Option: $_")
                }
            }
        }

        'models' {
            if ($prevElement -in @('--backend', '-b')) {
                $modelBackends | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                    [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Backend: $_")
                }
            } elseif ($wordToComplete -like '-*') {
                @('-b', '--backend', '-d', '--detailed', '--local', '--cloud', '-h', '--help') | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                    [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Option: $_")
                }
            }
        }

        'cost' {
            if ($prevElement -in @('--period', '-p')) {
                $costPeriods | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                    [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Period: $_")
                }
            } elseif ($wordToComplete -like '-*') {
                @('-p', '--period', '-b', '--by-backend', '--breakdown', '-h', '--help') | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                    [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Option: $_")
                }
            }
        }

        'test' {
            if ($prevElement -in @('--type', '-t')) {
                $testTypes | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                    [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Test type: $_")
                }
            } elseif ($wordToComplete -like '-*') {
                @('-t', '--type', '--coverage', '--watch', '-h', '--help') | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                    [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Option: $_")
                }
            }
        }

        'export' {
            if ($prevElement -in @('--format', '-f')) {
                $exportFormats | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                    [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Format: $_")
                }
            } elseif ($prevElement -in @('--what', '-w')) {
                $exportTypes | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                    [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Type: $_")
                }
            } elseif ($prevElement -in @('--output', '-o')) {
                Complete-File -WordToComplete $wordToComplete
            } elseif ($wordToComplete -like '-*') {
                @('-o', '--output', '-f', '--format', '-w', '--what', '-c', '--compress', '--validate', '-h', '--help') | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                    [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Option: $_")
                }
            }
        }

        'import' {
            if ($prevElement -in @('--mode', '-m')) {
                $importModes | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                    [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Mode: $_")
                }
            } elseif ($prevElement -in @('--type', '-t')) {
                $importTypes | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                    [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Type: $_")
                }
            } elseif ($elementCount -eq 2 -and -not ($wordToComplete -like '-*')) {
                Complete-File -WordToComplete $wordToComplete
            } elseif ($wordToComplete -like '-*') {
                @('-m', '--mode', '-t', '--type', '--validate', '--dry-run', '-h', '--help') | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                    [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Option: $_")
                }
            }
        }

        'help' {
            if ($elementCount -eq 2) {
                $commands | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
                    [CompletionResult]::new($_, $_, [CompletionResultType]::ParameterValue, "Command: $_")
                }
            }
        }
    }
}

# Helper function to complete file paths
function Complete-File {
    param([string]$WordToComplete)

    if ([string]::IsNullOrWhiteSpace($WordToComplete)) {
        $WordToComplete = '*'
    }

    # Expand relative paths
    $path = $WordToComplete
    if (-not [System.IO.Path]::IsPathRooted($path)) {
        $path = Join-Path $PWD $path
    }

    $directory = [System.IO.Path]::GetDirectoryName($path)
    $fileLeaf = [System.IO.Path]::GetFileName($path)

    if ([string]::IsNullOrEmpty($directory)) {
        $directory = $PWD
    }

    if (Test-Path $directory) {
        Get-ChildItem -Path $directory -Filter "$fileLeaf*" -ErrorAction SilentlyContinue | ForEach-Object {
            $completionText = if ($wordToComplete -match '[/\\]') {
                # Preserve directory structure
                $directoryName = [System.IO.Path]::GetFileName($directory)
                "$directoryName/$($_.Name)"
            } else {
                $_.Name
            }

            $listItem = if ($_.PSIsContainer) {
                [CompletionResultType]::ProviderContainer
            } else {
                [CompletionResultType]::ParameterValue
            }

            [CompletionResult]::new($completionText, $_.Name, $listItem, $_.FullName)
        }
    }
}

# Register the completer
Register-ArgumentCompleter -Native -CommandName 'aequor' -ScriptBlock $script:block
