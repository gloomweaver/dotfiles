-- claudecode.nvim — Claude Code inside Neovim
-- Opens the `claude` CLI in a side terminal and connects it to the editor:
-- Claude sees your current file/selection, and its edits show up as diffs to accept or deny
return {
  "coder/claudecode.nvim",
  dependencies = { "folke/snacks.nvim" },  -- terminal provider
  -- Load at startup (not on first keypress) so the editor is always discoverable:
  -- a `claude` running in another tmux pane can attach to this nvim with `/ide`
  event = "VeryLazy",
  config = true,
  keys = {
    { "<leader>ac", "<cmd>ClaudeCode<CR>", desc = "Toggle Claude" },
    { "<leader>af", "<cmd>ClaudeCodeFocus<CR>", desc = "Focus Claude" },
    { "<leader>ar", "<cmd>ClaudeCode --resume<CR>", desc = "Resume a Claude session" },
    { "<leader>aC", "<cmd>ClaudeCode --continue<CR>", desc = "Continue last Claude session" },
    { "<leader>am", "<cmd>ClaudeCodeSelectModel<CR>", desc = "Select Claude model" },

    -- Context
    { "<leader>ab", "<cmd>ClaudeCodeAdd %<CR>", desc = "Add current buffer" },
    { "<leader>as", "<cmd>ClaudeCodeSend<CR>", mode = "v", desc = "Send selection to Claude" },
    { "<leader>as", "<cmd>ClaudeCodeTreeAdd<CR>", desc = "Add file", ft = { "minifiles", "netrw" } },

    -- Diffs proposed by Claude
    { "<leader>aa", "<cmd>ClaudeCodeDiffAccept<CR>", desc = "Accept diff" },
    { "<leader>ad", "<cmd>ClaudeCodeDiffDeny<CR>", desc = "Deny diff" },
  },
}
