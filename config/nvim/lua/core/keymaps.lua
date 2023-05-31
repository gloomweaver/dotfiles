vim.g.mapleader = " "
vim.g.maplocalleader = " "
vim.g.copilot_no_tab_map = true
vim.api.nvim_set_keymap("i", "<C-w>", 'copilot#Accept("<CR>")', {
  silent = true,
  expr = true,
})

vim.keymap.set("n", "x", '"_x')
-- Increment/decrement
vim.keymap.set("n", "+", "<C-a>")
vim.keymap.set("n", "-", "<C-x>")
-- Select all
vim.keymap.set("n", "<C-a>", "gg<S-v>G")

vim.keymap.set("n", "<leader>h", ":nohlsearch<CR>")
