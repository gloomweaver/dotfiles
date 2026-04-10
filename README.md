# Dotfiles

Personal dotfiles managed with [GNU Stow](https://www.gnu.org/software/stow/). Catppuccin Mocha everywhere.

## Quick Start

```bash
git clone https://github.com/gloomweaver/dotfiles.git ~/dotfiles
cd ~/dotfiles
./install.sh
```

The installer is **idempotent** — safe to re-run at any time.

### What `install.sh` does

1. Installs Homebrew (if missing)
2. Installs all packages from `Brewfile.mac` (macOS only)
3. Stows all configs (fish, ghostty, tmux, nvim, aerospace, pi)
4. Sets fish as default shell
5. Installs Fisher (fish plugin manager) + plugins
6. Installs TPM (tmux plugin manager)
7. Installs VitePlus
8. Installs Pi via `vp install -g @mariozechner/pi-coding-agent`
9. Installs pi extension dependencies (webfetch)
10. Optionally applies macOS defaults (keyboard, Finder, Dock)

## Structure

```
~/dotfiles/
├── fish/           # Fish shell — config, functions, completions
├── ghostty/        # Ghostty terminal — theme, opacity, titlebar
├── tmux/           # Tmux — Catppuccin status bar, plugins, keybindings
├── nvim/           # Neovim — LSP, completion, telescope, treesitter
├── aerospace/      # AeroSpace — tiling window manager
├── pi/             # Pi coding agent — agents, extensions, prompts, theme
├── Brewfile.mac    # Homebrew packages (brew bundle dump to update)
├── install.sh      # Idempotent installer
└── .gitignore
```

### Stow packages

| Package | Target | Stow mode |
|---|---|---|
| `fish` | `~/.config/fish/` | normal |
| `ghostty` | `~/.config/ghostty/` | normal |
| `tmux` | `~/.tmux.conf` | normal |
| `nvim` | `~/.config/nvim/` | normal |
| `aerospace` | `~/.aerospace.toml` | normal |
| `pi` | `~/.pi/agent/` | `--no-folding` (preserves sessions/auth) |

---

## Fish Shell

Default shell. Config: `fish/.config/fish/config.fish`

### Custom commands

| Command | Description |
|---|---|
| `dotsync` | Restow all packages, commit & push dotfiles |
| `t` | Tmux session picker (fzf) |
| `t .` | New tmux session named after current folder |
| `t <name>` | Create/attach to named tmux session |
| `gpush` | `git push origin HEAD` |
| `branch <name>` | `git checkout -b <name>` |
| `load_env .env` | Export KEY=VALUE pairs from a file |
| `w <name>` | Create git worktree as sibling directory |
| `w close` | Remove current worktree, cd to main |
| `wt <name>` | Create worktree + tmux session in it |

### Aliases

| Alias | Expands to |
|---|---|
| `ls` | `eza -a --icons --group-directories-first` |
| `ll` | `eza -la --icons --group-directories-first` |
| `lg` | `lazygit` |
| `cat` | `bat --style=plain` |

### PATH (configured automatically)

Homebrew, asdf, Go, Rust, Bun, pnpm, NVM, Coursier, OrbStack, VitePlus, `~/.local/bin`

---

## Tmux

Prefix: **`Ctrl+a`**

### Keybindings

#### With prefix

| Key | Action |
|---|---|
| `\` | Split horizontal |
| `-` | Split vertical |
| `c` | New window (current path) |
| `h/j/k/l` | Navigate panes |
| `<` / `>` | Move window left/right |
| `,` | Rename window |
| `$` | Rename session |
| `s` | List sessions |
| `z` | Toggle pane zoom |
| `x` | Kill pane |
| `&` | Kill window |
| `d` | Detach |
| `t` | Popup terminal (80%) |
| `g` | Popup lazygit (90%) |
| `Y` | Enter copy mode (vi) |
| `r` | Reload config |
| `I` | Install TPM plugins |

#### No-prefix (global)

| Key | Action | ⚠️ Note |
|---|---|---|
| `Alt+h/j/k/l` | Navigate panes | Aerospace grabs these |
| `Alt+Shift+h/j/k/l` | Resize panes | Aerospace grabs these |
| `Alt+[` / `Alt+]` | Prev/next window | |
| `Alt+1-9` | Jump to window | Aerospace grabs these |

> **Conflict:** Aerospace intercepts all `Alt` keybindings globally. Use prefix versions (`Ctrl+a` then `h/j/k/l`, `1-9`) when inside a terminal.

#### Copy mode (vi)

`Y` → `v` (select) → `y` (copy to clipboard) → `q` (exit)

### Plugins

- **tmux-sensible** — sane defaults
- **tmux-resurrect** — save/restore sessions across restarts
- **tmux-continuum** — auto-save every 15 min, auto-restore
- **vim-tmux-navigator** — seamless `Ctrl+h/j/k/l` between nvim and tmux

---

## Neovim

Leader: **Space**. Press Space and wait — which-key shows all available keybindings.

### Find (Telescope)

| Key | Action |
|---|---|
| `Space ff` | Find files |
| `Space fr` | Recent files |
| `Space sg` | Search by grep |
| `Space sw` | Search current word |
| `Space bb` | Switch buffers |
| `Space fh` | Help tags |
| `Space gf` | Git files |
| `Space gc` | Git commits |
| `Space sr` | Resume last search |

Inside telescope: `Ctrl+j/k` navigate, `Esc` close, `Enter` open, `Ctrl+q` send to quickfix.

### Code (LSP)

| Key | Action |
|---|---|
| `gd` | Go to definition |
| `gD` | Go to declaration |
| `gr` | Go to references |
| `gi` | Go to implementation |
| `gt` | Go to type definition |
| `K` | Hover docs |
| `Ctrl+s` | Signature help |
| `Space ca` | Code action |
| `Space cr` | Rename symbol |
| `Space cf` | Format file |
| `Space cd` | Line diagnostics |
| `[d` / `]d` | Prev/next diagnostic |

### Autocompletion (insert mode)

| Key | Action |
|---|---|
| `Ctrl+j/k` | Navigate menu |
| `Enter` | Accept |
| `Ctrl+e` | Cancel |
| `Ctrl+Space` | Trigger manually |
| `Tab` / `Shift+Tab` | Snippet placeholders |

### File explorer (mini.files)

| Key | Action |
|---|---|
| `Space e` | Explorer at current file |
| `Space E` | Explorer at project root |
| `l` / `Enter` | Open / enter directory |
| `h` | Parent directory |

### Git (gitsigns)

| Key | Action |
|---|---|
| `]h` / `[h` | Next/prev hunk |
| `Space gs` | Stage hunk |
| `Space gu` | Undo stage hunk |
| `Space gr` | Reset hunk |
| `Space gS` / `gR` | Stage/reset entire file |
| `Space gp` | Preview hunk |
| `Space gb` | Blame line |
| `Space gd` | Diff against index |

### Navigation

| Key | Action |
|---|---|
| `Ctrl+h/j/k/l` | Move between splits |
| `Ctrl+d` / `Ctrl+u` | Scroll half-page (centered) |
| `J` / `K` (visual) | Move selection up/down |
| `Space w` | Save |

### Plugin management

`:Lazy` — plugin manager · `:Mason` — LSP server manager · `:TSInstall <lang>` — treesitter parser

### Installed LSP servers

lua, typescript, go, rust, python, json, yaml, html, css, bash, elixir, tailwindcss

---

## AeroSpace

Tiling window manager. All keybindings are global `Alt+...`.

| Key | Action |
|---|---|
| `Alt+h/j/k/l` | Focus window |
| `Alt+Shift+h/j/k/l` | Move window |
| `Alt+1-9` | Switch workspace |
| `Alt+a-z` | Switch workspace A-Z |
| `Alt+Shift+1-9` | Move window to workspace |
| `Alt+-` / `Alt+=` | Resize |
| `Alt+/` | Toggle tiles layout |
| `Alt+,` | Toggle accordion layout |
| `Alt+Tab` | Previous workspace |
| `Alt+Shift+;` | Enter service mode |

Service mode: `r` reset layout, `f` toggle floating, `Esc` exit.

---

## Pi Coding Agent

Theme: Catppuccin Mocha (matches everything else).

### Extensions

| Extension | Description |
|---|---|
| **subagent** | Delegate tasks to specialized agents (single, parallel, chain) |
| **plan** | Read-only exploration mode — `/plan` to toggle |
| **webfetch** | Fetch and convert web pages to markdown |
| **notify** | macOS native notifications |

### Agents (for subagent)

| Agent | Model | Role |
|---|---|---|
| **scout** | claude-haiku-4-5 | Fast codebase recon |
| **planner** | claude-sonnet-4-5 | Implementation planning (read-only) |
| **worker** | claude-sonnet-4-5 | Code implementation (full access) |
| **reviewer** | claude-sonnet-4-5 | Code review (read-only) |

### Prompt templates (type `/` in pi)

| Template | Pipeline |
|---|---|
| `/scout-and-plan` | scout → planner |
| `/implement` | scout → planner → worker |
| `/implement-and-review` | worker → reviewer → worker |

### Skills

- **find-skills** — discover community skills via `npx skills find`

---

## Updating

### After editing dotfiles

```bash
dotsync
```

### After installing new brew packages

```bash
cd ~/dotfiles
brew bundle dump --file=Brewfile.mac --force
```

### Re-run full installer

```bash
cd ~/dotfiles
./install.sh
```
