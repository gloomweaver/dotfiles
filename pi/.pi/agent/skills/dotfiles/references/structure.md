# Dotfiles Structure

All paths relative to `~/dotfiles/`. Each top-level directory is a stow package.

## fish/ → ~/.config/fish/

```
fish/.config/fish/
├── config.fish              # Environment: PATH, editor, homebrew, asdf, go, rust, bun, pnpm
├── fish_plugins             # Fisher plugin list (source of truth — run `fisher update`)
├── conf.d/
│   ├── aliases.fish         # All aliases (ls, ll, lt, lg, cat, git shortcuts)
│   └── tools.fish           # Starship prompt, zoxide init
└── functions/
    ├── g.fish               # Git shorthand
    ├── gpush.fish           # git push origin HEAD
    ├── ghpr.fish            # Push + create GitHub PR
    ├── branch.fish          # git checkout -b
    ├── dotsync.fish         # Restow + commit + push dotfiles
    ├── dotbackup.fish       # Timestamped config backup
    ├── dotrestore.fish      # Restore from backup (fzf)
    ├── load_env.fish        # Load .env into shell
    ├── t.fish               # Tmux session picker/creator
    ├── w.fish               # Git worktree manager
    ├── wt.fish              # Worktree + tmux session
    ├── note.fish            # Quick timestamped notes
    └── y.fish               # Yazi with cd tracking
```

## ghostty/ → ~/.config/ghostty/

```
ghostty/.config/ghostty/
└── config                   # Font, theme (catppuccin-mocha), opacity, keybindings
```

## tmux/ → ~/.tmux.conf

```
tmux/
└── .tmux.conf               # Catppuccin Mocha status bar, Ctrl+a prefix, TPM plugins
```

Plugins managed by TPM (installed to `~/.tmux/plugins/`):
- tmux-sensible, tmux-resurrect, tmux-continuum, vim-tmux-navigator

## nvim/ → ~/.config/nvim/

```
nvim/.config/nvim/
├── init.lua                 # Options, keymaps, lazy.nvim bootstrap
└── lua/plugins/
    ├── colorscheme.lua      # Catppuccin Mocha
    ├── telescope.lua        # Fuzzy finder
    ├── treesitter.lua       # Syntax highlighting & text objects
    ├── which-key.lua        # Keybinding hints on Space
    ├── lsp.lua              # Mason + lspconfig + blink.cmp
    ├── completion.lua       # blink.cmp autocompletion
    ├── explorer.lua         # mini.files file explorer
    ├── gitsigns.lua         # Git gutter signs & hunk actions
    └── statusline.lua       # lualine status bar
```

Plugin manager: lazy.nvim (lock file: `nvim/lazy-lock.json`)
LSP manager: Mason (servers installed to `~/.local/share/nvim/mason/`)

## aerospace/ → ~/.aerospace.toml

```
aerospace/
└── .aerospace.toml          # Tiling WM: Alt+hjkl focus, Alt+1-9 workspaces
```

## pi/ → ~/.pi/agent/ (--no-folding)

```
pi/.pi/agent/
├── settings.json            # Provider: openai-codex, model: gpt-5.4, theme: catppuccin-mocha
├── agents/                  # Subagent personas (scout, planner, worker, reviewer)
├── extensions/
│   ├── subagent/            # Delegate to specialized agents
│   ├── plan/                # Read-only exploration mode
│   ├── webfetch/            # Fetch web pages as markdown
│   └── notify/              # macOS native notifications
├── prompts/                 # Prompt templates (/scout-and-plan, /implement, /implement-and-review)
├── skills/
│   ├── dotfiles/            # THIS SKILL — dotfiles management from any repo
│   └── find-skills/         # Discover community skills
└── themes/
    └── catppuccin-mocha.json
```

**Not tracked** (local to machine): `sessions/`, `auth.json`

## Root Files

| File | Purpose |
|------|---------|
| `Brewfile.mac` | Homebrew packages — `brew bundle dump --file=Brewfile.mac --force` to update |
| `install.sh` | Idempotent installer (homebrew, packages, stow, fish, fisher, TPM, macOS defaults) |
| `.gitignore` | Excludes fish_variables, fisher-managed files, pi sessions/auth, brew lock |
| `README.md` | Full documentation with all keybindings and commands |
