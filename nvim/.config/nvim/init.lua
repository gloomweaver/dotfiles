-- ══════════════════════════════════════════════════════════
--  Neovim config — built from zero
-- ══════════════════════════════════════════════════════════

-- Leader key (must be set before plugins load)
-- Space is the most ergonomic leader — thumb press, no stretching
vim.g.mapleader = " "
vim.g.maplocalleader = " "

-- ── Core options ────────────────────────────────────────
local opt = vim.opt

-- Workaround: tmux doesn't support colored underlines (CSI 58) properly,
-- which causes raw escape codes to leak. Disable underline styling in tmux.
if vim.env.TMUX then
  vim.api.nvim_create_autocmd("ColorScheme", {
    callback = function()
      -- Remove sp (special/underline color) from diagnostic highlights
      for _, name in ipairs({ "DiagnosticUnderlineError", "DiagnosticUnderlineWarn", "DiagnosticUnderlineInfo", "DiagnosticUnderlineHint" }) do
        local hl = vim.api.nvim_get_hl(0, { name = name })
        hl.sp = nil
        hl.undercurl = nil
        hl.underline = true
        vim.api.nvim_set_hl(0, name, hl)
      end
    end,
  })
end

-- Line numbers
opt.number = true            -- show line numbers
opt.relativenumber = true    -- relative to cursor (makes j/k jumps easy: 5j, 12k)

-- Tabs & indentation
opt.tabstop = 4              -- tab = 4 spaces visually
opt.shiftwidth = 4           -- indent with 4 spaces
opt.expandtab = true         -- tabs become spaces
opt.smartindent = true       -- auto-indent new lines

-- Search
opt.ignorecase = true        -- case-insensitive search
opt.smartcase = true         -- ...unless you type a capital letter
opt.hlsearch = true          -- highlight matches
opt.incsearch = true         -- highlight as you type

-- Appearance
opt.termguicolors = true     -- 24-bit color (needed for themes)
opt.signcolumn = "yes"       -- always show sign column (no layout shift)
opt.cursorline = true        -- highlight current line
opt.scrolloff = 8            -- keep 8 lines visible above/below cursor
opt.sidescrolloff = 8        -- same for horizontal
opt.wrap = false             -- no line wrapping
opt.showmode = false         -- mode shown in statusline instead

-- Splits
opt.splitright = true        -- new vertical splits go right
opt.splitbelow = true        -- new horizontal splits go below

-- Files
opt.swapfile = false         -- no .swp files
opt.backup = false           -- no backup files
opt.undofile = true          -- persistent undo (survives closing file)
opt.undodir = vim.fn.stdpath("data") .. "/undo"

-- Misc
opt.clipboard = "unnamedplus"  -- use system clipboard
opt.updatetime = 250           -- faster CursorHold events
opt.timeoutlen = 300           -- faster key sequence completion
opt.mouse = "a"                -- mouse works everywhere
opt.completeopt = "menuone,noselect"  -- better completion menu

-- ── Keymaps ─────────────────────────────────────────────
local map = vim.keymap.set

-- Clear search highlight with Escape
map("n", "<Esc>", "<cmd>nohlsearch<CR>")

-- Better window navigation (Ctrl+h/j/k/l)
map("n", "<C-h>", "<C-w>h", { desc = "Move to left pane" })
map("n", "<C-j>", "<C-w>j", { desc = "Move to lower pane" })
map("n", "<C-k>", "<C-w>k", { desc = "Move to upper pane" })
map("n", "<C-l>", "<C-w>l", { desc = "Move to right pane" })

-- Move selected lines up/down in visual mode
map("v", "J", ":m '>+1<CR>gv=gv", { desc = "Move selection down" })
map("v", "K", ":m '<-2<CR>gv=gv", { desc = "Move selection up" })

-- Keep cursor centered when scrolling
map("n", "<C-d>", "<C-d>zz", { desc = "Scroll down (centered)" })
map("n", "<C-u>", "<C-u>zz", { desc = "Scroll up (centered)" })

-- Keep cursor centered when jumping between search results
map("n", "n", "nzzzv")
map("n", "N", "Nzzzv")

-- Don't overwrite register when pasting over selection
map("x", "p", '"_dP')

-- Quick save
map("n", "<leader>w", "<cmd>w<CR>", { desc = "Save file" })

-- ── Plugin manager (lazy.nvim) ──────────────────────────
-- Bootstrap: auto-install lazy.nvim if not present
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
  vim.fn.system({
    "git", "clone", "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable",
    lazypath,
  })
end
vim.opt.rtp:prepend(lazypath)

-- Load plugins from lua/plugins/ directory
-- Each file in lua/plugins/ returns a table (or list of tables)
-- This keeps things modular — one file per plugin/concern
require("lazy").setup("plugins", {
  change_detection = { notify = false },
})
