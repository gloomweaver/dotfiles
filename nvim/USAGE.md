# Neovim Cheat Sheet

Leader key is **Space**.

## Finding things (Telescope)

| Key | Action |
|---|---|
| `Space ff` | Find files |
| `Space fr` | Recent files |
| `Space sg` | Search by grep (all files) |
| `Space sw` | Search word under cursor |
| `Space bb` | Switch open buffers |
| `Space fh` | Search help docs |
| `Space gf` | Git files |
| `Space gc` | Git commits |
| `Space sr` | Resume last search |

Inside telescope: `Ctrl+j/k` navigate, `Esc` close, `Enter` open.

## Code (LSP)

Available when a language server is attached to the buffer.

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
| `[d` / `]d` | Previous / next diagnostic |

## Autocompletion (insert mode)

| Key | Action |
|---|---|
| `Ctrl+j` / `Ctrl+k` | Navigate menu |
| `Enter` | Accept |
| `Ctrl+e` | Cancel |
| `Ctrl+Space` | Trigger manually |
| `Tab` / `Shift+Tab` | Jump snippet placeholders |
| `Ctrl+d` / `Ctrl+u` | Scroll docs |

## File explorer (mini.files)

| Key | Action |
|---|---|
| `Space e` | Explorer at current file |
| `Space E` | Explorer at project root |
| `l` / `Enter` | Open / enter directory |
| `h` | Parent directory |

## Git (gitsigns)

| Key | Action |
|---|---|
| `]h` / `[h` | Next / previous hunk |
| `Space gs` | Stage hunk |
| `Space gu` | Undo stage hunk |
| `Space gr` | Reset hunk |
| `Space gS` | Stage entire file |
| `Space gR` | Reset entire file |
| `Space gp` | Preview hunk |
| `Space gb` | Blame line (full) |
| `Space gd` | Diff against index |

## Navigation

| Key | Action |
|---|---|
| `Ctrl+h/j/k/l` | Move between splits |
| `Ctrl+d` / `Ctrl+u` | Scroll half-page (centered) |
| `n` / `N` | Next/prev search result (centered) |
| `Esc` | Clear search highlight |

## Editing

| Key | Action |
|---|---|
| `J` / `K` (visual) | Move selection down/up |
| `p` (visual) | Paste without losing register |
| `Space w` | Save file |

## Plugin management

| Command | Action |
|---|---|
| `:Lazy` | Open plugin manager |
| `:Mason` | Open LSP server manager |
| `:TSInstall <lang>` | Install treesitter parser |

## Discovery

Press **Space** and wait — which-key shows all available keybindings.
