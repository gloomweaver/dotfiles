-- Telescope — fuzzy finder for everything
-- Depends on: ripgrep (rg), fd — both already in your Brewfile
return {
  "nvim-telescope/telescope.nvim",
  branch = "0.1.x",
  dependencies = {
    "nvim-lua/plenary.nvim",  -- utility library (required)
    {
      -- Native C sorter — makes filtering ~10x faster
      "nvim-telescope/telescope-fzf-native.nvim",
      build = "make",
    },
  },
  config = function()
    local telescope = require("telescope")
    local actions = require("telescope.actions")

    telescope.setup({
      defaults = {
        preview = {
          -- Telescope's built-in treesitter previewer is incompatible with the
          -- installed nvim-treesitter API on this setup, so disable it here.
          treesitter = false,
        },
        -- What to ignore when searching
        file_ignore_patterns = {
          "node_modules/", ".git/", "dist/", "build/",
          "target/", "__pycache__/", ".venv/",
        },
        -- Keymaps inside the telescope popup
        mappings = {
          i = {  -- insert mode (while typing in the prompt)
            ["<C-j>"] = actions.move_selection_next,
            ["<C-k>"] = actions.move_selection_previous,
            ["<C-q>"] = actions.send_selected_to_qflist + actions.open_qflist,
            ["<Esc>"] = actions.close,  -- single Esc to close (no normal mode)
          },
        },
        layout_config = {
          prompt_position = "top",
        },
        sorting_strategy = "ascending",
      },
    })

    telescope.load_extension("fzf")

    -- Ensure preview windows get proper filetype + highlighting
    vim.api.nvim_create_autocmd("User", {
      pattern = "TelescopePreviewerLoaded",
      callback = function()
        local buf = vim.api.nvim_get_current_buf()
        local path = vim.api.nvim_buf_get_name(buf)

        if path ~= "" then
          local ft = vim.filetype.match({ filename = path, buf = buf })
          if ft and ft ~= "" then
            vim.bo[buf].filetype = ft
            vim.bo[buf].syntax = ft
          end
        end

        -- Prefer treesitter, but let regex syntax highlighting work as fallback
        pcall(vim.treesitter.start, buf)
      end,
    })

    -- Keymaps
    local builtin = require("telescope.builtin")
    local map = vim.keymap.set

    -- Files
    map("n", "<leader>ff", builtin.find_files, { desc = "Find files" })
    map("n", "<leader>fr", builtin.oldfiles, { desc = "Recent files" })

    -- Search
    map("n", "<leader>sg", builtin.live_grep, { desc = "Search by grep" })
    map("n", "<leader>sw", builtin.grep_string, { desc = "Search current word" })

    -- Buffers & help
    map("n", "<leader>bb", builtin.buffers, { desc = "Open buffers" })
    map("n", "<leader>fh", builtin.help_tags, { desc = "Help tags" })

    -- Git
    map("n", "<leader>gf", builtin.git_files, { desc = "Git files" })
    map("n", "<leader>gc", builtin.git_commits, { desc = "Git commits" })

    -- Resume last search
    map("n", "<leader>sr", builtin.resume, { desc = "Resume last search" })
  end,
}
