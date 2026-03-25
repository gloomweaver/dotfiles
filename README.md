# Dotfiles

Personal dotfiles managed with [GNU Stow](https://www.gnu.org/software/stow/).

## Quick Start

```bash
git clone https://github.com/<user>/dotfiles.git ~/dotfiles
cd ~/dotfiles
./install.sh
```

The installer is **idempotent** — safe to re-run at any time.

## What it does

1. Installs Homebrew (if missing)
2. Installs core CLI tools: fish, starship, fzf, ripgrep, fd, bat, eza, zoxide, git-delta, neovim, tmux, lazygit, gh, jq, asdf
3. Symlinks configs via stow (fish, ghostty, misc)
4. Sets fish as the default shell
5. Installs Fisher (fish plugin manager) and TPM (tmux plugin manager)
6. Optionally applies macOS defaults (keyboard, Finder, Dock)

## Structure

```
~/dotfiles/
├── fish/           # Fish shell config (~/.config/fish/)
├── ghostty/        # Ghostty terminal (~/.config/ghostty/)
├── misc/           # Aliases (~/.aliases)
├── Brewfile.mac    # Full Homebrew bundle (apps, taps, go tools, etc.)
├── install.sh      # Idempotent installer
└── .gitignore
```

## Manual Stow

```bash
cd ~/dotfiles
stow fish       # ~/.config/fish/
stow ghostty    # ~/.config/ghostty/
stow misc       # ~/.aliases
```

## Paths migrated from zsh

The fish config (`fish/.config/fish/config.fish`) consolidates all PATH
variables that were previously scattered across `.zshrc`, `.zprofile`,
`.zsh_profile`, `.path`, and `.profile`:

- Homebrew, asdf, Go, Rust, Bun, pnpm, NVM, Coursier, OrbStack, `~/.local/bin`

The old zsh files can be kept around for compatibility or removed once
fish is the default shell.
