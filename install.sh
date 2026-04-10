#!/bin/bash
# Dotfiles installer — idempotent, safe to re-run
# Usage: ./install.sh
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOTFILES_DIR="$SCRIPT_DIR"

# ── Colors ───────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()    { echo -e "${CYAN}[INFO]${NC} $1"; }
ok()      { echo -e "${GREEN}  ✓${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()     { echo -e "${RED}[ERR]${NC} $1"; }
step()    { echo -e "\n${CYAN}═══ $1 ═══${NC}"; }

command_exists() { command -v "$1" &>/dev/null; }

# Retry a command up to N times (for password prompts)
# Usage: retry 3 "description" command arg1 arg2...
retry() {
    local max_attempts="$1" desc="$2"
    shift 2
    local attempt=1
    while (( attempt <= max_attempts )); do
        if "$@"; then
            return 0
        fi
        if (( attempt == max_attempts )); then
            err "$desc failed after $max_attempts attempts"
            return 1
        fi
        warn "$desc failed (attempt $attempt/$max_attempts) — try again"
        ((attempt++))
    done
}

confirm() {
    local msg="$1" default="${2:-y}"
    local prompt="[Y/n]"
    [[ "$default" == "n" ]] && prompt="[y/N]"
    read -p "$msg $prompt " response
    response="${response:-$default}"
    [[ "$response" =~ ^[Yy]$ ]]
}

# ── Homebrew ─────────────────────────────────────────────
ensure_homebrew() {
    if command_exists brew; then
        ok "Homebrew already installed"
        return
    fi
    info "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    eval "$(/opt/homebrew/bin/brew shellenv)" 2>/dev/null || eval "$(/usr/local/bin/brew shellenv)"
    ok "Homebrew installed"
}

# ── Stow helper (idempotent) ────────────────────────────
stow_package() {
    local pkg="$1"
    if [[ ! -d "$DOTFILES_DIR/$pkg" ]]; then
        warn "Package '$pkg' not found, skipping"
        return
    fi
    # Restow: removes old symlinks, re-creates them
    if stow -d "$DOTFILES_DIR" -t "$HOME" -R "$pkg" 2>/dev/null; then
        ok "Stowed $pkg"
    else
        # Conflict — adopt existing files then restow so dotfiles version wins
        warn "Conflicts for $pkg — adopting existing files..."
        stow -d "$DOTFILES_DIR" -t "$HOME" --adopt "$pkg"
        stow -d "$DOTFILES_DIR" -t "$HOME" -R "$pkg"
        ok "Stowed $pkg (adopted conflicts)"
    fi
}

# Stow with --no-folding: symlinks individual files, not directories
# Use for packages that share a directory with non-managed files (e.g. ~/.pi/agent/sessions)
stow_package_no_folding() {
    local pkg="$1"
    if [[ ! -d "$DOTFILES_DIR/$pkg" ]]; then
        warn "Package '$pkg' not found, skipping"
        return
    fi
    if stow -d "$DOTFILES_DIR" -t "$HOME" -R --no-folding "$pkg" 2>/dev/null; then
        ok "Stowed $pkg (no-folding)"
    else
        warn "Conflicts for $pkg — adopting existing files..."
        stow -d "$DOTFILES_DIR" -t "$HOME" --adopt --no-folding "$pkg"
        # Restore dotfiles versions after adopt
        (cd "$DOTFILES_DIR" && git checkout -- "$pkg" 2>/dev/null || true)
        stow -d "$DOTFILES_DIR" -t "$HOME" -R --no-folding "$pkg"
        ok "Stowed $pkg (no-folding, adopted conflicts)"
    fi
}

# ── Backup existing configs before first run ─────────────
backup_if_needed() {
    local path="$1"
    # Only back up real files/dirs, not symlinks (symlinks mean stow already ran)
    if [[ -e "$path" ]] && [[ ! -L "$path" ]]; then
        local backup_dir="$HOME/.dotfiles-backups/$(date +%Y%m%d-%H%M%S)"
        mkdir -p "$backup_dir"
        local rel="${path#$HOME/}"
        mkdir -p "$backup_dir/$(dirname "$rel")"
        cp -R "$path" "$backup_dir/$rel"
        info "Backed up $path → $backup_dir/$rel"
    fi
}

# ══════════════════════════════════════════════════════════
#  Main
# ══════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}       ${GREEN}Dotfiles Installer${NC}              ${CYAN}║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Homebrew ──────────────────────────────────────────
step "Homebrew"
ensure_homebrew

# ── 2. Packages from Brewfile ────────────────────────────
if [[ "$(uname)" == "Darwin" ]]; then
    step "Packages (Brewfile.mac)"
    info "Running brew bundle (skips already-installed packages)..."
    brew bundle --file="$DOTFILES_DIR/Brewfile.mac"
    rm -f "$DOTFILES_DIR/Brewfile.mac.lock.json"
    ok "Brewfile.mac applied"
else
    step "Packages"
    info "Skipping Brewfile.mac (not macOS)"
fi

# ── 3. Backup & Stow ────────────────────────────────────
step "Linking dotfiles (stow)"

# Backup real (non-symlink) configs that stow would overwrite
backup_if_needed "$HOME/.config/fish"
backup_if_needed "$HOME/.config/ghostty"
backup_if_needed "$HOME/.config/starship.toml"
backup_if_needed "$HOME/.tmux.conf"

stow_package "fish"
stow_package "ghostty"
stow_package "tmux"
stow_package "nvim"
stow_package "aerospace"
stow_package "starship"
stow_package_no_folding "pi"

# ── 4. Fish as default shell ────────────────────────────
step "Fish shell"
FISH_PATH="$(which fish)"
if [[ "$SHELL" == *"fish"* ]]; then
    ok "Fish is already the default shell"
else
    # Ensure fish is in /etc/shells
    if ! grep -qF "$FISH_PATH" /etc/shells 2>/dev/null; then
        info "Adding fish to /etc/shells (needs sudo)..."
        if ! retry 3 "sudo" sudo sh -c "echo '$FISH_PATH' >> /etc/shells"; then
            warn "Could not add fish to /etc/shells — run manually:"
            echo "  echo $FISH_PATH | sudo tee -a /etc/shells"
        fi
    fi
    if confirm "Set fish as default shell?" "y"; then
        if ! retry 3 "chsh" chsh -s "$FISH_PATH"; then
            warn "Could not change shell — run manually: chsh -s $FISH_PATH"
        else
            ok "Default shell changed to fish"
        fi
    else
        info "Skipped — run 'chsh -s $FISH_PATH' later to switch"
    fi
fi

# ── 5. Fisher plugin manager ────────────────────────────
step "Fisher (fish plugin manager)"
if fish -c "type -q fisher" 2>/dev/null; then
    ok "Fisher already installed"
else
    info "Installing Fisher..."
    fish -c "curl -sL https://raw.githubusercontent.com/jorgebucaran/fisher/main/functions/fisher.fish | source && fisher install jorgebucaran/fisher" 2>/dev/null
    ok "Fisher installed"
fi

# Install plugins from fish_plugins if present
if [[ -f "$DOTFILES_DIR/fish/.config/fish/fish_plugins" ]]; then
    info "Syncing fish plugins..."
    fish -c "fisher update" 2>/dev/null || true
    ok "Fish plugins synced"
fi

# ── 6. Tmux Plugin Manager ──────────────────────────────
step "Tmux Plugin Manager (TPM)"
if [[ -d "$HOME/.tmux/plugins/tpm" ]]; then
    ok "TPM already installed"
else
    info "Installing TPM..."
    git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
    ok "TPM installed — press Ctrl+b I inside tmux to install plugins"
fi

# ── 7. asdf ──────────────────────────────────────────────
step "asdf"
if command_exists asdf; then
    ok "asdf already installed"
else
    warn "asdf not found — it should have been installed via Brewfile"
fi

# ── 8. VitePlus ──────────────────────────────────────────
step "VitePlus"
if command_exists vp; then
    ok "VitePlus already installed"
else
    info "Installing VitePlus..."
    curl -fsSL https://vite.plus | bash
    ok "VitePlus installed"
fi

# ── 9. Pi coding agent ───────────────────────────────────
step "Pi coding agent"
if command_exists pi; then
    ok "Pi already installed ($(pi --version 2>/dev/null || echo 'unknown version'))"
else
    info "Installing pi coding agent via VitePlus..."
    vp install -g @mariozechner/pi-coding-agent
    ok "Pi installed"
fi

# ── 10. Pi extension dependencies ────────────────────────
step "Pi extensions"
if [[ -f "$HOME/.pi/agent/extensions/webfetch/package.json" ]]; then
    info "Installing webfetch dependencies..."
    (cd "$HOME/.pi/agent/extensions/webfetch" && npm install --silent 2>/dev/null)
    ok "webfetch ready"
else
    info "Skipping (pi extensions not found)"
fi

# ── 10. Create ~/.local/bin ──────────────────────────────
mkdir -p "$HOME/.local/bin"

# ── 11. macOS defaults ──────────────────────────────────
if [[ "$(uname)" == "Darwin" ]]; then
    step "macOS defaults"
    if confirm "Apply recommended macOS defaults? (keyboard, Finder, Dock)" "y"; then
        # Fast key repeat
        defaults write NSGlobalDomain KeyRepeat -int 2
        defaults write NSGlobalDomain InitialKeyRepeat -int 15
        defaults write NSGlobalDomain ApplePressAndHoldEnabled -bool false

        # Finder: show all files, extensions, path bar
        defaults write com.apple.finder AppleShowAllFiles -bool true
        defaults write NSGlobalDomain AppleShowAllExtensions -bool true
        defaults write com.apple.finder ShowPathbar -bool true
        defaults write com.apple.finder ShowStatusBar -bool true
        defaults write com.apple.finder FXEnableExtensionChangeWarning -bool false

        # Dock: autohide, no recents
        defaults write com.apple.dock autohide -bool true
        defaults write com.apple.dock autohide-delay -float 0
        defaults write com.apple.dock show-recents -bool false

        # Disable auto-correct annoyances
        defaults write NSGlobalDomain NSAutomaticCapitalizationEnabled -bool false
        defaults write NSGlobalDomain NSAutomaticSpellingCorrectionEnabled -bool false
        defaults write NSGlobalDomain NSAutomaticQuoteSubstitutionEnabled -bool false
        defaults write NSGlobalDomain NSAutomaticDashSubstitutionEnabled -bool false
        defaults write NSGlobalDomain NSAutomaticPeriodSubstitutionEnabled -bool false

        # Window behavior: disable animations, allow drag from anywhere with Ctrl+Cmd
        defaults write NSGlobalDomain NSAutomaticWindowAnimationsEnabled -bool false
        defaults write NSGlobalDomain NSWindowShouldDragOnGesture -bool true

        # Screenshots: png, no shadow
        defaults write com.apple.screencapture type -string "png"
        defaults write com.apple.screencapture disable-shadow -bool true

        for app in "Dock" "Finder"; do
            killall "$app" &>/dev/null || true
        done
        ok "macOS defaults applied"
    else
        info "Skipped macOS defaults"
    fi
fi

# ── Done ─────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}     ${CYAN}Installation complete!${NC}             ${GREEN}║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
info "Next steps:"
echo "  1. Restart your terminal (or run: exec fish)"
echo "  2. In tmux, press Ctrl+b I to install plugins"
echo "  3. starship and zoxide will activate automatically in fish"
echo ""
if [[ -d "$HOME/.dotfiles-backups" ]]; then
    info "Backups stored in ~/.dotfiles-backups/"
fi
