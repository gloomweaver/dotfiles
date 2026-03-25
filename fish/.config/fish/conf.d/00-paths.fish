# ── PATH & environment setup ─────────────────────────────
# Loaded early (00-) so tools in conf.d/ can find binaries

set fish_greeting ""

# ── Editor ───────────────────────────────────────────────
set -gx EDITOR nvim
set -gx VISUAL nvim

# ── Homebrew ─────────────────────────────────────────────
if test -f /opt/homebrew/bin/brew
    eval "$(/opt/homebrew/bin/brew shellenv)"
else if test -f /usr/local/bin/brew
    eval "$(/usr/local/bin/brew shellenv)"
end

# ── asdf version manager ────────────────────────────────
if test -f $HOMEBREW_PREFIX/opt/asdf/libexec/asdf.fish
    source $HOMEBREW_PREFIX/opt/asdf/libexec/asdf.fish
else if test -f ~/.asdf/asdf.fish
    source ~/.asdf/asdf.fish
end
if test -d ~/.asdf/shims
    fish_add_path ~/.asdf/shims
end

# ── Golang ───────────────────────────────────────────────
if command -q go
    fish_add_path (go env GOPATH)/bin
end

# ── Rust ─────────────────────────────────────────────────
fish_add_path ~/.cargo/bin
if test -d $HOMEBREW_PREFIX/opt/rustup/bin
    fish_add_path $HOMEBREW_PREFIX/opt/rustup/bin
end

# ── Bun ──────────────────────────────────────────────────
if test -d ~/.bun
    set -gx BUN_INSTALL ~/.bun
    fish_add_path $BUN_INSTALL/bin
end

# ── pnpm ─────────────────────────────────────────────────
if test -d ~/Library/pnpm
    set -gx PNPM_HOME ~/Library/pnpm
    fish_add_path $PNPM_HOME
end

# ── NVM ──────────────────────────────────────────────────
if test -d ~/.nvm
    set -gx NVM_DIR ~/.nvm
end

# ── Java (Coursier / Temurin) ────────────────────────────
if test -d "$HOME/Library/Application Support/Coursier/bin"
    fish_add_path "$HOME/Library/Application Support/Coursier/bin"
end

# ── Local bin ────────────────────────────────────────────
fish_add_path ~/.local/bin

# ── OrbStack ────────────────────────────────────────────
if test -f ~/.orbstack/shell/init.fish
    source ~/.orbstack/shell/init.fish
end
