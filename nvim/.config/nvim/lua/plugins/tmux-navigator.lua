-- vim-tmux-navigator — Ctrl+h/j/k/l moves between nvim splits and tmux panes
-- Counterpart of the tmux plugin of the same name in ~/.tmux.conf
return {
  "christoomey/vim-tmux-navigator",
  cmd = {
    "TmuxNavigateLeft",
    "TmuxNavigateDown",
    "TmuxNavigateUp",
    "TmuxNavigateRight",
  },
  init = function()
    vim.g.tmux_navigator_no_mappings = 1  -- we define the keys below
  end,
  keys = {
    { "<C-h>", "<cmd>TmuxNavigateLeft<CR>", desc = "Move to left pane" },
    { "<C-j>", "<cmd>TmuxNavigateDown<CR>", desc = "Move to lower pane" },
    { "<C-k>", "<cmd>TmuxNavigateUp<CR>", desc = "Move to upper pane" },
    { "<C-l>", "<cmd>TmuxNavigateRight<CR>", desc = "Move to right pane" },
  },
}
