-- Catppuccin Mocha — matches Ghostty and tmux
return {
  "catppuccin/nvim",
  name = "catppuccin",
  priority = 1000,  -- load before other plugins so colors are available
  config = function()
    require("catppuccin").setup({
      flavour = "mocha",
      transparent_background = true,  -- let Ghostty's opacity show through
      integrations = {
        treesitter = true,
        native_lsp = { enabled = true },
        gitsigns = true,
        telescope = true,
        mason = true,
        which_key = true,
      },
    })
    vim.cmd.colorscheme("catppuccin")
  end,
}
