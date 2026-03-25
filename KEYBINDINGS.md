# Keybindings

All keybindings across all configured programs.
Useful for spotting conflicts (search for the same key combo across sections).

---

## AeroSpace (window manager)

Global keybindings — intercepted before any app sees them.

### Window focus & movement

| Key | Action |
|---|---|
| `Alt+h/j/k/l` | Focus window left/down/up/right |
| `Alt+Shift+h/j/k/l` | Move window left/down/up/right |
| `Alt+-` / `Alt+=` | Resize smaller / larger |
| `Alt+/` | Toggle tiles horizontal/vertical |
| `Alt+,` | Toggle accordion horizontal/vertical |

### Workspaces

| Key | Action |
|---|---|
| `Alt+1-9` | Switch to workspace 1–9 |
| `Alt+a-z` | Switch to workspace A–Z |
| `Alt+Shift+1-9` | Move window to workspace 1–9 |
| `Alt+Shift+a-z` | Move window to workspace A–Z |
| `Alt+Tab` | Previous workspace |
| `Alt+Shift+Tab` | Move workspace to next monitor |

### Service mode (`Alt+Shift+;` to enter)

| Key | Action |
|---|---|
| `Esc` | Reload config, exit service mode |
| `r` | Reset layout (flatten tree) |
| `f` | Toggle floating/tiling |
| `Backspace` | Close all windows but current |
| `Alt+Shift+h/j/k/l` | Join with adjacent window |

---

## Tmux

Prefix is **`Ctrl+a`**. Keys below are pressed after prefix unless marked "no prefix".

### Sessions

| Key | Action |
|---|---|
| `d` | Detach |
| `$` | Rename session |
| `s` | List/switch sessions |

### Windows

| Key | Action |
|---|---|
| `c` | New window (current path) |
| `,` | Rename window |
| `<` / `>` | Move window left/right |
| `&` | Kill window |

### Panes

| Key | Action |
|---|---|
| `\` | Split horizontal |
| `-` | Split vertical |
| `h/j/k/l` | Navigate panes (with prefix) |
| `z` | Toggle zoom |
| `x` | Kill pane |

### No-prefix shortcuts

| Key | Action | ⚠️ Conflict |
|---|---|---|
| `Alt+h/j/k/l` | Navigate panes | **Aerospace grabs these globally** |
| `Alt+Shift+h/j/k/l` | Resize panes | **Aerospace grabs these globally** |
| `Alt+[` / `Alt+]` | Previous/next window | |
| `Alt+1-9` | Jump to window | **Aerospace grabs these globally** |

### Popups

| Key | Action |
|---|---|
| `t` | Popup terminal (80%) |
| `g` | Popup lazygit (90%) |

### Copy mode (vi)

| Key | Action |
|---|---|
| `Y` | Enter copy mode |
| `v` | Start selection |
| `Ctrl+v` | Rectangle selection |
| `y` | Copy to clipboard |
| `/` / `?` | Search forward/backward |
| `q` | Exit |

### Misc

| Key | Action |
|---|---|
| `r` | Reload config |
| `?` | List all keybindings |
| `I` | Install TPM plugins |

---

## Neovim

Leader is **Space**. Mode: **n** = normal, **v** = visual, **i** = insert.

### Navigation (normal)

| Key | Action |
|---|---|
| `Ctrl+h/j/k/l` | Move between splits |
| `Ctrl+d` / `Ctrl+u` | Scroll half-page (centered) |
| `n` / `N` | Next/prev search result (centered) |
| `Esc` | Clear search highlight |

### Editing

| Key | Mode | Action |
|---|---|---|
| `J` / `K` | visual | Move selection down/up |
| `p` | visual | Paste without losing register |
| `Space w` | normal | Save file |

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

Active when a language server is attached.

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
| `[d` / `]d` | Previous/next diagnostic |

### Autocompletion (insert mode)

| Key | Action |
|---|---|
| `Ctrl+j` / `Ctrl+k` | Navigate menu |
| `Enter` | Accept |
| `Ctrl+e` | Cancel |
| `Ctrl+Space` | Trigger manually |
| `Tab` / `Shift+Tab` | Jump snippet placeholders |
| `Ctrl+d` / `Ctrl+u` | Scroll docs |

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
| `]h` / `[h` | Next/previous hunk |
| `Space gs` | Stage hunk |
| `Space gu` | Undo stage hunk |
| `Space gr` | Reset hunk |
| `Space gS` | Stage entire file |
| `Space gR` | Reset entire file |
| `Space gp` | Preview hunk |
| `Space gb` | Blame line |
| `Space gd` | Diff against index |

### Plugin management

| Command | Action |
|---|---|
| `:Lazy` | Plugin manager |
| `:Mason` | LSP server manager |
| `:TSInstall <lang>` | Install treesitter parser |

Press **Space** and wait — which-key shows all available keybindings.

---

## Known conflicts

| Key | Aerospace | Tmux | Winner |
|---|---|---|---|
| `Alt+h/j/k/l` | Focus window | Navigate panes | **Aerospace** (global grab) |
| `Alt+Shift+h/j/k/l` | Move window | Resize panes | **Aerospace** (global grab) |
| `Alt+1-9` | Switch workspace | Jump to window | **Aerospace** (global grab) |

Tmux fallback: use `Ctrl+a` then `h/j/k/l` for panes, `Ctrl+a` then `1-9` for windows.
