-- Lualine — statusline that shows mode, file, git, diagnostics, LSP
return {
  "nvim-lualine/lualine.nvim",
  dependencies = { "nvim-tree/nvim-web-devicons" },
  event = "VeryLazy",
  config = function()
    require("lualine").setup({
      options = {
        theme = "catppuccin",
        component_separators = { left = "│", right = "│" },
        section_separators = { left = "", right = "" },
        globalstatus = true,  -- single statusline for all splits
      },
      sections = {
        -- Left
        lualine_a = { "mode" },
        lualine_b = { "branch", "diff" },
        lualine_c = {
          { "filename", path = 1 },  -- 1 = relative path
        },
        -- Right
        lualine_x = {
          {
            "diagnostics",
            symbols = { error = " ", warn = " ", info = " ", hint = "󰌵 " },
          },
        },
        lualine_y = { "filetype" },
        lualine_z = { "location" },
      },
    })
  end,
}
