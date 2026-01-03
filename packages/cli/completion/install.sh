#!/bin/bash
# Installation script for shell completions
# Usage: ./install.sh [shell]
#   shell: bash | zsh | fish | all (default: auto-detect)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_ROOT="$(dirname "$SCRIPT_DIR")"

# Detect shell
detect_shell() {
    if [ -n "$1" ]; then
        echo "$1"
        return
    fi

    if [ -n "$SHELL" ]; then
        case "$SHELL" in
            */bash)
                echo "bash"
                ;;
            */zsh)
                echo "zsh"
                ;;
            */fish)
                echo "fish"
                ;;
        esac
    fi

    # Fallback to bash
    echo "bash"
}

# Install bash completion
install_bash() {
    echo -e "${GREEN}Installing bash completion...${NC}"

    local completion_dir="$HOME/.bash-completion/completions"
    local completion_file="$completion_dir/aequor"

    # Create directory if it doesn't exist
    mkdir -p "$completion_dir"

    # Copy completion file
    cp "$SCRIPT_DIR/bash/aequor.bash" "$completion_file"

    # Add to .bashrc if not already present
    local bashrc="$HOME/.bashrc"
    if ! grep -q "aequor.bash" "$bashrc" 2>/dev/null; then
        echo "" >> "$bashrc"
        echo "# Aequor CLI completion" >> "$bashrc"
        echo "source \"$completion_file\"" >> "$bashrc"
        echo -e "${GREEN}Added completion to ~/.bashrc${NC}"
    else
        echo -e "${YELLOW}Completion already in ~/.bashrc${NC}"
    fi

    echo -e "${GREEN}Bash completion installed successfully!${NC}"
    echo -e "${YELLOW}Run 'source ~/.bashrc' or restart your shell to enable.${NC}"
}

# Install zsh completion
install_zsh() {
    echo -e "${GREEN}Installing zsh completion...${NC}"

    local completion_dir="$HOME/.zsh/completions"
    local completion_file="$completion_dir/_aequor"

    # Create directory if it doesn't exist
    mkdir -p "$completion_dir"

    # Copy completion file
    cp "$SCRIPT_DIR/zsh/_aequor" "$completion_file"

    # Add to .zshrc if not already present
    local zshrc="$HOME/.zshrc"
    if ! grep -q "fpath+=.*zsh/completions" "$zshrc" 2>/dev/null; then
        echo "" >> "$zshrc"
        echo "# Aequor CLI completion" >> "$zshrc"
        echo "fpath=(\"$completion_dir\" \$fpath)" >> "$zshrc"
        echo "autoload -U compinit && compinit" >> "$zshrc"
        echo -e "${GREEN}Added completion to ~/.zshrc${NC}"
    else
        echo -e "${YELLOW}Completion already in ~/.zshrc${NC}"
    fi

    echo -e "${GREEN}Zsh completion installed successfully!${NC}"
    echo -e "${YELLOW}Run 'source ~/.zshrc' or restart your shell to enable.${NC}"
}

# Install for system-wide bash (requires sudo)
install_bash_system() {
    echo -e "${GREEN}Installing bash completion system-wide...${NC}"

    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}This requires sudo privileges${NC}"
        echo "Please run: sudo $0 bash-system"
        exit 1
    fi

    local completion_dir="/usr/share/bash-completion/completions"
    local completion_file="$completion_dir/aequor"

    # Copy completion file
    cp "$SCRIPT_DIR/bash/aequor.bash" "$completion_file"

    echo -e "${GREEN}System-wide bash completion installed successfully!${NC}"
    echo -e "${YELLOW}Restart your shell to enable.${NC}"
}

# Install for system-wide zsh (requires sudo)
install_zsh_system() {
    echo -e "${GREEN}Installing zsh completion system-wide...${NC}"

    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}This requires sudo privileges${NC}"
        echo "Please run: sudo $0 zsh-system"
        exit 1
    fi

    local completion_dir="/usr/share/zsh/vendor-completions"
    local completion_file="$completion_dir/_aequor"

    # Copy completion file
    cp "$SCRIPT_DIR/zsh/_aequor" "$completion_file"

    echo -e "${GREEN}System-wide zsh completion installed successfully!${NC}"
    echo -e "${YELLOW}Restart your shell to enable.${NC}"
}

# Uninstall completions
uninstall() {
    echo -e "${GREEN}Uninstalling shell completions...${NC}"

    # Remove bash completion
    rm -f "$HOME/.bash-completion/completions/aequor"
    rm -f "/usr/share/bash-completion/completions/aequor"

    # Remove zsh completion
    rm -f "$HOME/.zsh/completions/_aequor"
    rm -f "/usr/share/zsh/vendor-completions/_aequor"

    # Remove from .bashrc
    if [ -f "$HOME/.bashrc" ]; then
        sed -i.bak '/# Aequor CLI completion/,+2d' "$HOME/.bashrc" 2>/dev/null || true
    fi

    # Remove from .zshrc
    if [ -f "$HOME/.zshrc" ]; then
        sed -i.bak '/# Aequor CLI completion/,+3d' "$HOME/.zshrc" 2>/dev/null || true
    fi

    echo -e "${GREEN}Completions uninstalled successfully!${NC}"
    echo -e "${YELLOW}You may need to restart your shell for changes to take effect.${NC}"
}

# Show help
show_help() {
    cat << EOF
Aequor CLI Completion Installation Script

Usage: $0 [command]

Commands:
  bash        Install bash completion for current user
  zsh         Install zsh completion for current user
  bash-system Install bash completion system-wide (requires sudo)
  zsh-system  Install zsh completion system-wide (requires sudo)
  all         Install all completions for current user
  uninstall   Uninstall all completions
  help        Show this help message

If no command is specified, the shell will be auto-detected.

Examples:
  $0                 # Auto-detect and install
  $0 bash            # Install bash completion
  $0 zsh             # Install zsh completion
  $0 all             # Install all completions
  sudo $0 bash-system  # Install system-wide

After installation, restart your shell or run:
  bash: source ~/.bashrc
  zsh:  source ~/.zshrc
EOF
}

# Main script
main() {
    local shell
    local command="${1:-}"

    case "$command" in
        bash)
            install_bash
            ;;
        zsh)
            install_zsh
            ;;
        bash-system)
            install_bash_system
            ;;
        zsh-system)
            install_zsh_system
            ;;
        all)
            install_bash
            install_zsh
            ;;
        uninstall)
            uninstall
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            shell=$(detect_shell "$command")
            echo -e "${GREEN}Detected shell: $shell${NC}"
            case "$shell" in
                bash)
                    install_bash
                    ;;
                zsh)
                    install_zsh
                    ;;
                *)
                    echo -e "${RED}Unsupported shell: $shell${NC}"
                    echo "Run '$0 help' for usage information"
                    exit 1
                    ;;
            esac
            ;;
    esac
}

main "$@"
