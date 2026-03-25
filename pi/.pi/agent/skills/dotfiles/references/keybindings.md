# Keybindings Reference

## Tmux

Prefix: **Ctrl+a**

### With Prefix

| Key | Action |
|-----|--------|
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

### No-prefix (Global)

| Key | Action | Note |
|-----|--------|------|
| `Alt+h/j/k/l` | Navigate panes | ⚠️ Aerospace grabs these |
| `Alt+Shift+h/j/k/l` | Resize panes | ⚠️ Aerospace grabs these |
| `Alt+[` / `Alt+]` | Prev/next window | |
| `Alt+1-9` | Jump to window | ⚠️ Aerospace grabs these |

> **Conflict:** AeroSpace intercepts all `Alt` keybindings globally. Use prefix versions (`Ctrl+a` then key) inside terminals.

### Copy Mode (vi)

`Y` → `v` select → `y` copy to clipboard → `q` exit

### Plugins

- **tmux-sensible** — sane defaults
- **tmux-resurrect** — save/restore sessions across restarts
- **tmux-continuum** — auto-save every 15 min, auto-restore on start
- **vim-tmux-navigator** — seamless `Ctrl+h/j/k/l` between nvim and tmux panes

---

## Neovim

Leader: **Space** (press and wait for which-key popup)

### Find (Telescope)

| Key | Action |
|-----|--------|
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
|-----|--------|
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

### Autocompletion (Insert Mode)

| Key | Action |
|-----|--------|
| `Ctrl+j/k` | Navigate menu |
| `Enter` | Accept |
| `Ctrl+e` | Cancel |
| `Ctrl+Space` | Trigger manually |
| `Tab` / `Shift+Tab` | Snippet placeholders |

### File Explorer (mini.files)

| Key | Action |
|-----|--------|
| `Space e` | Explorer at current file |
| `Space E` | Explorer at project root |
| `l` / `Enter` | Open / enter directory |
| `h` | Parent directory |

### Git (gitsigns)

| Key | Action |
|-----|--------|
| `]h` / `[h` | Next/prev hunk |
| `Space gs` | Stage hunk |
| `Space gu` | Undo stage |
| `Space gr` | Reset hunk |
| `Space gS` / `gR` | Stage/reset entire file |
| `Space gp` | Preview hunk |
| `Space gb` | Blame line |
| `Space gd` | Diff against index |

### Navigation

| Key | Action |
|-----|--------|
| `Ctrl+h/j/k/l` | Move between splits (integrates with tmux) |
| `Ctrl+d` / `Ctrl+u` | Half-page scroll (centered) |
| `J` / `K` (visual) | Move selection up/down |
| `Space w` | Save |

### LSP Servers (Mason)

lua, typescript, go, rust, python, json, yaml, html, css, bash, elixir, tailwindcss

### Plugin Management

`:Lazy` — plugin manager · `:Mason` — LSP server manager · `:TSInstall <lang>` — treesitter parser

---

## AeroSpace

Tiling window manager. All keybindings are global `Alt+...`.

| Key | Action |
|-----|--------|
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

## Fish Shell (fzf.fish plugin)

| Key | Action |
|-----|--------|
| `Ctrl+R` | Search command history |
| `Ctrl+Alt+F` | Search files |
| `Ctrl+Alt+L` | Search git log |
| `Ctrl+Alt+S` | Search git status |
| `Ctrl+Alt+P` | Search processes |
| `Ctrl+V` | Search shell variables |

---

## Known Conflicts

| Keys | AeroSpace | Tmux |
|------|-----------|------|
| `Alt+h/j/k/l` | Focus window (wins) | Navigate panes (use `Ctrl+a h/j/k/l`) |
| `Alt+Shift+h/j/k/l` | Move window (wins) | Resize panes (use mouse or `Ctrl+a` bindings) |
| `Alt+1-9` | Switch workspace (wins) | Jump to window (use `Ctrl+a 1-9`) |
