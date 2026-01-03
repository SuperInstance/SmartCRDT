# Bash completion for Aequor CLI
# To enable, source this file from your .bashrc:
#   source /path/to/aequor.bash
#
# Or install system-wide:
#   sudo cp aequor.bash /usr/share/bash-completion/completions/aequor

_aequor_completion() {
    local cur prev words cword
    COMPREPLY=()
    cur="${COMP_WORDS[COMP_CWORD]}"
    prev="${COMP_WORDS[COMP_CWORD-1]}"
    words=("${COMP_WORDS[@]}")
    cword=$COMP_CWORD

    # Main commands
    local commands="query chat status cache cartridge training system privacy config models cost test export import help examples quickstart version"

    # Cache subcommands
    local cache_commands="stats clear warm invalidate"

    # Cartridge subcommands
    local cartridge_commands="list install load unload create export"

    # Training subcommands
    local training_commands="shadow train deploy rollback ab-test"

    # System subcommands
    local system_commands="info health metrics"

    # Privacy subcommands
    local privacy_commands="classify redact encode audit"

    # Config options
    local config_options="--list --get --set --reset"
    local config_keys="cache.enabled cache.size cache.ttl privacy.epsilon privacy.enabled router.backend router.threshold models.local models.cloud"

    # Query options
    local query_backends="local cloud auto"
    local query_formats="text json"
    local query_models="local cloud"

    # Model backends
    local model_backends="local cloud"

    # Cost periods
    local cost_periods="today week month all"

    # Test types
    local test_types="unit integration e2e performance"

    # Export formats
    local export_formats="json jsonl cartridge"

    # Export types
    local export_types="all knowledge cache history training"

    # Import modes
    local import_modes="merge replace"

    # Import types
    local import_types="all knowledge cache history training"

    # Complete main commands
    if [[ ${cword} -eq 1 ]]; then
        COMPREPLY=($(compgen -W "${commands}" -- "${cur}"))
        return 0
    fi

    # Complete subcommands based on parent command
    case "${words[1]}" in
        cache)
            if [[ ${cword} -eq 2 ]]; then
                COMPREPLY=($(compgen -W "${cache_commands}" -- "${cur}"))
            elif [[ ${cword} -eq 3 && ${words[2]} == "invalidate" ]]; then
                # Complete file names for invalidate
                COMPREPLY=($(compgen -f -- "${cur}"))
            fi
            ;;
        cartridge)
            if [[ ${cword} -eq 2 ]]; then
                COMPREPLY=($(compgen -W "${cartridge_commands}" -- "${cur}"))
            elif [[ ${cword} -eq 3 ]]; then
                case "${words[2]}" in
                    install|create|export)
                        # Complete file names
                        COMPREPLY=($(compgen -f -- "${cur}"))
                        ;;
                    load|unload)
                        # Complete cartridge names from system
                        local cartridges=$(aequor cartridge list --quiet 2>/dev/null)
                        COMPREPLY=($(compgen -W "${cartridges}" -- "${cur}"))
                        ;;
                esac
            fi
            ;;
        training)
            if [[ ${cword} -eq 2 ]]; then
                COMPREPLY=($(compgen -W "${training_commands}" -- "${cur}"))
            elif [[ ${cword} -eq 3 ]]; then
                case "${words[2]}" in
                    deploy|ab-test)
                        # Complete file names
                        COMPREPLY=($(compgen -f -- "${cur}"))
                        ;;
                esac
            fi
            ;;
        system)
            if [[ ${cword} -eq 2 ]]; then
                COMPREPLY=($(compgen -W "${system_commands}" -- "${cur}"))
            fi
            ;;
        privacy)
            if [[ ${cword} -eq 2 ]]; then
                COMPREPLY=($(compgen -W "${privacy_commands}" -- "${cur}"))
            fi
            ;;
        config)
            if [[ ${cword} -eq 2 ]]; then
                COMPREPLY=($(compgen -W "${config_options}" -- "${cur}"))
            elif [[ ${cword} -eq 3 ]]; then
                case "${words[2]}" in
                    --get|--set)
                        COMPREPLY=($(compgen -W "${config_keys}" -- "${cur}"))
                        ;;
                esac
            fi
            ;;
        query)
            if [[ ${prev} == "--backend" || ${prev} == "-b" ]]; then
                COMPREPLY=($(compgen -W "${query_backends}" -- "${cur}"))
            elif [[ ${prev} == "--format" || ${prev} == "-f" ]]; then
                COMPREPLY=($(compgen -W "${query_formats}" -- "${cur}"))
            elif [[ ${prev} == "--model" || ${prev} == "-m" ]]; then
                # Complete model names
                local models=$(aequor models list --quiet 2>/dev/null)
                COMPREPLY=($(compgen -W "${models}" -- "${cur}"))
            fi
            ;;
        chat)
            if [[ ${prev} == "--backend" || ${prev} == "-b" ]]; then
                COMPREPLY=($(compgen -W "${query_backends}" -- "${cur}"))
            elif [[ ${prev} == "--model" || ${prev} == "-m" ]]; then
                local models=$(aequor models list --quiet 2>/dev/null)
                COMPREPLY=($(compgen -W "${models}" -- "${cur}"))
            elif [[ ${prev} == "--history" ]]; then
                COMPREPLY=($(compgen -f -- "${cur}"))
            fi
            ;;
        models)
            if [[ ${prev} == "--backend" || ${prev} == "-b" ]]; then
                COMPREPLY=($(compgen -W "${model_backends}" -- "${cur}"))
            fi
            ;;
        cost)
            if [[ ${prev} == "--period" || ${prev} == "-p" ]]; then
                COMPREPLY=($(compgen -W "${cost_periods}" -- "${cur}"))
            fi
            ;;
        test)
            if [[ ${prev} == "--type" || ${prev} == "-t" ]]; then
                COMPREPLY=($(compgen -W "${test_types}" -- "${cur}"))
            fi
            ;;
        export)
            if [[ ${prev} == "--format" || ${prev} == "-f" ]]; then
                COMPREPLY=($(compgen -W "${export_formats}" -- "${cur}"))
            elif [[ ${prev} == "--what" || ${prev} == "-w" ]]; then
                COMPREPLY=($(compgen -W "${export_types}" -- "${cur}"))
            elif [[ ${prev} == "--output" || ${prev} == "-o" ]]; then
                COMPREPLY=($(compgen -f -- "${cur}"))
            fi
            ;;
        import)
            if [[ ${prev} == "--mode" || ${prev} == "-m" ]]; then
                COMPREPLY=($(compgen -W "${import_modes}" -- "${cur}"))
            elif [[ ${prev} == "--type" || ${prev} == "-t" ]]; then
                COMPREPLY=($(compgen -W "${import_types}" -- "${cur}"))
            elif [[ ${cword} -eq 2 ]]; then
                # Complete file names for import
                COMPREPLY=($(compgen -f -- "${cur}"))
            fi
            ;;
        help)
            if [[ ${cword} -eq 2 ]]; then
                COMPREPLY=($(compgen -W "${commands}" -- "${cur}"))
            fi
            ;;
    esac

    # Complete options for any command
    if [[ ${cur} == -* ]]; then
        case "${words[1]}" in
            query)
                COMPREPLY=($(compgen -W "-t --trace -b --backend -m --model -f --format --no-cache -h --help -v --verbose" -- "${cur}"))
                ;;
            chat)
                COMPREPLY=($(compgen -W "-b --backend -m --model --no-cache --history -h --help" -- "${cur}"))
                ;;
            status)
                COMPREPLY=($(compgen -W "-c --components -m --metrics -v --verbose -h --help" -- "${cur}"))
                ;;
            cache)
                COMPREPLY=($(compgen -W "-h --help" -- "${cur}"))
                ;;
            cartridge)
                COMPREPLY=($(compgen -W "-h --help" -- "${cur}"))
                ;;
            training)
                COMPREPLY=($(compgen -W "-h --help" -- "${cur}"))
                ;;
            system)
                COMPREPLY=($(compgen -W "-h --help" -- "${cur}"))
                ;;
            privacy)
                COMPREPLY=($(compgen -W "--classify --redact --encode --audit -d --detailed -h --help" -- "${cur}"))
                ;;
            config)
                COMPREPLY=($(compgen -W "--list --get --set --reset --global --local -h --help" -- "${cur}"))
                ;;
            models)
                COMPREPLY=($(compgen -W "-b --backend -d --detailed --local --cloud -h --help" -- "${cur}"))
                ;;
            cost)
                COMPREPLY=($(compgen -W "-p --period -b --by-backend --breakdown -h --help" -- "${cur}"))
                ;;
            test)
                COMPREPLY=($(compgen -W "-t --type --coverage --watch -h --help" -- "${cur}"))
                ;;
            export)
                COMPREPLY=($(compgen -W "-o --output -f --format -w --what -c --compress --validate -h --help" -- "${cur}"))
                ;;
            import)
                COMPREPLY=($(compgen -W "-m --mode -t --type --validate --dry-run -h --help" -- "${cur}"))
                ;;
        esac
    fi

    return 0
}

complete -F _aequor_completion aequor
