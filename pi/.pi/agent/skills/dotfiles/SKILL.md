---
name: dotfiles
description: Manage and edit user's dotfiles configuration. Use when the user mentions dotfiles, config, shell, fish, tmux, neovim, nvim, aerospace, ghostty, keybindings, aliases, terminal setup, stow, brew packages, or asks to fix/change/recommend anything about their development environment.
---

# Dotfiles

All configuration lives in `~/dotfiles/` managed by GNU Stow. **Always edit files in `~/dotfiles/<package>/...`**, never at the symlink target.

## Repo Layout

```
~/dotfiles/
├── fish/       → ~/.config/fish/         # Fish shell (default shell)
├── ghostty/    → ~/.config/ghostty/      # Ghostty terminal
├── tmux/       → ~/.tmux.conf            # Tmux multiplexer
├── nvim/       → ~/.config/nvim/         # Neovim (from scratch, lazy.nvim)
├── aerospace/  → ~/.aerospace.toml       # AeroSpace tiling WM
├── pi/         → ~/.pi/agent/            # Pi coding agent (--no-folding)
├── Brewfile.mac                          # Homebrew packages (source of truth)
├── install.sh                            # Idempotent installer
└── .gitignore
```

## How to Edit

1. **Edit** the source file in `~/dotfiles/<package>/...`
2. **Apply** with stow:
   ```bash
   # Normal packages
   cd ~/dotfiles && stow -R <package>
   # Pi package (preserves sessions/auth.json)
   cd ~/dotfiles && stow -R --no-folding --adopt pi && git checkout -- pi
   ```
3. Or just run the fish function `dotsync` to restow everything, commit, and push.

## Fish Custom Functions

Read the full source at `~/dotfiles/fish/.config/fish/functions/<name>.fish`

| Function | Description |
|----------|-------------|
| `g` | Git shorthand — no args = `git status -sb`, else passes through (`g add .`) |
| `gpush` | `git push origin HEAD` |
| `branch <name>` | `git checkout -b <name>` |
| `ghpr` | Push current branch + create GitHub PR via `gh` CLI |
| `t` | Tmux session picker with fzf (restores sessions via resurrect) |
| `t .` | New tmux session named after current directory |
| `t <name>` | Create/attach named tmux session in current directory |
| `w <name>` | Create git worktree as sibling directory |
| `w close` | Remove current worktree, cd back to main |
| `wt <name>` | Create git worktree + open tmux session in it |
| `dotsync` | Restow all packages, `git add/commit/push` dotfiles |
| `dotbackup` | Timestamped backup of configs to `~/.dotfiles-backups/` |
| `dotrestore` | Restore configs from backup (fzf picker) |
| `load_env <file>` | Export KEY=VALUE pairs from .env file into shell |
| `note [text]` | Quick notes — no args opens `~/notes/scratch.md`, with args appends timestamped line |
| `y` | Yazi file manager with cd-on-quit |

## Fish Aliases

Defined in `~/dotfiles/fish/.config/fish/conf.d/aliases.fish`

| Alias | Expands to |
|-------|------------|
| `ls` | `eza -a --icons --group-directories-first` |
| `ll` | `eza -la --icons --group-directories-first` |
| `lt` | `eza -a --icons --tree --level=2` |
| `lg` | `lazygit` |
| `cat` | `bat --style=plain` |
| `gs` | `git status -sb` |
| `ga` | `git add` |
| `gc` | `git commit` |
| `gd` | `git diff` |
| `gds` | `git diff --staged` |
| `gp` | `git pull` |
| `gl` | `git log --oneline --graph --decorate -20` |

## Fisher Plugins

Defined in `~/dotfiles/fish/.config/fish/fish_plugins`

- **jethrokuan/z** — directory jumping (`z foo` jumps to most-frecent dir matching "foo")
- **patrickf1/fzf.fish** — `Ctrl+R` history, `Ctrl+Alt+F` files, `Ctrl+Alt+L` git log, `Ctrl+Alt+S` git status
- **jorgebucaran/autopair.fish** — auto-close brackets, quotes, backticks
- **catppuccin/fish** — Catppuccin Mocha color theme for fish

## Tool Integrations

Configured in `~/dotfiles/fish/.config/fish/conf.d/tools.fish`

- **Starship** — cross-shell prompt (config: `~/.config/starship.toml` if exists)
- **zoxide** — smart `cd` replacement (aliased as `cd`, `cdi` for interactive picker)
- **fzf** — fuzzy finder (keybindings via fzf.fish plugin above)

## Keybindings Quick Reference

For full keybinding tables, read [references/keybindings.md](references/keybindings.md).

**Tmux** — prefix `Ctrl+a`: `\` split-h, `-` split-v, `h/j/k/l` panes, `g` lazygit popup, `t` terminal popup, `Y` copy mode
**Neovim** — leader `Space`: `ff` find files, `sg` grep, `e` file explorer, `ca` code action, `gd` go-to-definition
**AeroSpace** — global `Alt`: `h/j/k/l` focus, `Shift+h/j/k/l` move, `1-9` workspace

## Structure Details

For annotated file trees of every package, read [references/structure.md](references/structure.md).

## Brewfile

`~/dotfiles/Brewfile.mac` is the single source of truth for Homebrew packages. To update after installing something new:
```bash
cd ~/dotfiles && brew bundle dump --file=Brewfile.mac --force
```

## Recommending Commands

When the user describes a workflow, suggest relevant fish functions:
- Working on a feature branch → `branch`, `gpush`, `ghpr`, `wt`
- Navigating projects → `t`, `z`, `y`
- Reviewing git changes → `g`, `gs`, `gd`, `gds`, `lg` (lazygit)
- Environment setup → `load_env`
- Dotfiles maintenance → `dotsync`, `dotbackup`, `dotrestore`
