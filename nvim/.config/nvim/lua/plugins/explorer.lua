-- mini.files — lightweight file explorer
-- Opens at the current file's location, navigate like a buffer
-- Much lighter than neo-tree/nvim-tree
return {
  "echasnovski/mini.files",
  version = false,
  config = function()
    require("mini.files").setup({
      -- Don't use default mappings for opening (we set our own)
      mappings = {
        go_in = "l",       -- open file / enter directory
        go_in_plus = "<CR>", -- open file and close explorer
        go_out = "h",      -- go to parent directory
        go_out_plus = "H", -- go to parent and close directory
      },
      windows = {
        preview = true,    -- show file preview
        width_preview = 40,
      },
    })

    -- Toggle explorer at current file
    vim.keymap.set("n", "<leader>e", function()
      local mf = require("mini.files")
      if not mf.close() then
        mf.open(vim.api.nvim_buf_get_name(0))  -- open at current file
      end
    end, { desc = "File explorer" })

    -- Open explorer at project root
    vim.keymap.set("n", "<leader>E", function()
      require("mini.files").open(vim.uv.cwd())
    end, { desc = "File explorer (root)" })
  end,
}
