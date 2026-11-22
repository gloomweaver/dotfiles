-- Snacks — picker (fuzzy finder for everything), replaces Telescope
-- Depends on: ripgrep (rg), fd — both already in your Brewfile
-- Also provides the terminal that claudecode.nvim opens Claude in
return {
  "folke/snacks.nvim",
  priority = 1000,
  lazy = false,  -- must be set up at startup (also takes over vim.ui.select)

  ---@module 'snacks'
  ---@type snacks.Config
  opts = {
    picker = {
      enabled = true,
      -- Include dotfiles (.config/, .tmux.conf, …); .git and .gitignore'd files stay excluded
      sources = {
        files = { hidden = true },
        grep = { hidden = true },
      },
      win = {
        input = {
          keys = {
            -- single Esc to close (no normal mode in the prompt)
            ["<Esc>"] = { "close", mode = { "n", "i" } },
            -- defaults worth knowing: <C-j>/<C-k> navigate, <C-q> send to quickfix
          },
        },
      },
    },
  },

  keys = {
    -- Files
    { "<leader>ff", function() Snacks.picker.files() end, desc = "Find files" },
    { "<leader>fr", function() Snacks.picker.recent() end, desc = "Recent files" },

    -- Search
    { "<leader>sg", function() Snacks.picker.grep() end, desc = "Search by grep" },
    { "<leader>sw", function() Snacks.picker.grep_word() end, desc = "Search current word", mode = { "n", "x" } },

    -- Buffers & help
    { "<leader>bb", function() Snacks.picker.buffers() end, desc = "Open buffers" },
    { "<leader>fh", function() Snacks.picker.help() end, desc = "Help tags" },

    -- Git
    { "<leader>gf", function() Snacks.picker.git_files() end, desc = "Git files" },
    { "<leader>gc", function() Snacks.picker.git_log() end, desc = "Git commits" },

    -- Resume last search
    { "<leader>sr", function() Snacks.picker.resume() end, desc = "Resume last search" },
  },
}
