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

# Use Homebrew ncurses terminfo (has modern capabilities: tmux-direct, Smulx, Setulc, smxx)
# opt/ncurses is a version-independent symlink, so this survives ncurses upgrades
if test -d $HOMEBREW_PREFIX/opt/ncurses/share/terminfo
    and not string match -q "*$HOMEBREW_PREFIX/opt/ncurses/share/terminfo*" -- "$TERMINFO_DIRS"
    # Quoted: an unset $TERMINFO_DIRS would otherwise expand the whole word to nothing.
    # The trailing ":" it leaves keeps the system default directories in the search.
    set -gx TERMINFO_DIRS "$HOMEBREW_PREFIX/opt/ncurses/share/terminfo:$TERMINFO_DIRS"
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

# ── Java (Coursier / Temurin) ────────────────────────────
if test -d "$HOME/Library/Application Support/Coursier/bin"
    fish_add_path "$HOME/Library/Application Support/Coursier/bin"
end

# ── PostgreSQL client (libpq is keg-only: psql, pg_dump, … are not linked) ──
if test -d $HOMEBREW_PREFIX/opt/libpq/bin
    fish_add_path $HOMEBREW_PREFIX/opt/libpq/bin
end

# ── Local bin ────────────────────────────────────────────
fish_add_path ~/.local/bin

# ── OrbStack ────────────────────────────────────────────
if test -f ~/.orbstack/shell/init.fish
    source ~/.orbstack/shell/init.fish
end
