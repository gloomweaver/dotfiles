# Tmux Cheat Sheet

Prefix is **`Ctrl+a`**.

## No-prefix shortcuts (fastest)

| Key | Action |
|---|---|
| `Alt+h/j/k/l` | Navigate panes |
| `Alt+Shift+h/j/k/l` | Resize panes |
| `Alt+[` / `Alt+]` | Previous / next window |
| `Alt+1-9` | Jump to window # |

## Sessions

| Key | Action |
|---|---|
| `tmux` | Start new session |
| `tmux new -s name` | Start named session |
| `d` | Detach |
| `tmux a` | Attach to last session |
| `$` | Rename session |
| `s` | List/switch sessions |

Sessions auto-save every 15 min and restore on start.

## Windows (tabs)

| Key | Action |
|---|---|
| `c` | New window (in current path) |
| `,` | Rename window |
| `<` / `>` | Move window left/right |
| `&` | Kill window |

## Panes (splits)

| Key | Action |
|---|---|
| `\` | Split horizontal (side by side) |
| `-` | Split vertical (top/bottom) |
| `z` | Toggle zoom (fullscreen pane) |
| `x` | Kill pane |

## Popups

| Key | Action |
|---|---|
| `t` | Popup terminal (80%) |
| `g` | Popup lazygit (90%) |

## Copy mode (vi)

| Key | Action |
|---|---|
| `Y` | Enter copy mode |
| `v` | Start selection |
| `Ctrl+v` | Rectangle selection |
| `y` | Copy to clipboard |
| `/` / `?` | Search forward/backward |
| `q` | Exit |

## Misc

| Key | Action |
|---|---|
| `r` | Reload config |
| `?` | List all keybindings |

## Plugins

Install with `Ctrl+a I` (capital I) on first launch.

- **tmux-sensible** — sane defaults
- **tmux-resurrect** — save/restore sessions across restarts
- **tmux-continuum** — auto-save & auto-restore
- **vim-tmux-navigator** — seamless `Ctrl+h/j/k/l` between vim & tmux
