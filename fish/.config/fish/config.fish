if status is-interactive
    # Commands to run in interactive sessions can go here
end

set fish_greeting ""

# Default editor
set -gx EDITOR nvim
set -gx VISUAL nvim

# Homebrew
if test -f /opt/homebrew/bin/brew
    eval "$(/opt/homebrew/bin/brew shellenv)"
else if test -f /usr/local/bin/brew
    eval "$(/usr/local/bin/brew shellenv)"
end

# asdf version manager
if test -f $HOMEBREW_PREFIX/opt/asdf/libexec/asdf.fish
    source $HOMEBREW_PREFIX/opt/asdf/libexec/asdf.fish
else if test -f ~/.asdf/asdf.fish
    source ~/.asdf/asdf.fish
end
if test -d ~/.asdf/shims
    fish_add_path ~/.asdf/shims
end

# Rust
fish_add_path ~/.cargo/bin

# Local bin
fish_add_path ~/.local/bin

# fzf
if command -q fzf
    fzf --fish 2>/dev/null | source
end

# Starship prompt
if command -q starship
    starship init fish | source
end

# zoxide
if command -q zoxide
    zoxide init fish | source
end
