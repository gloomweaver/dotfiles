return {
  {
    "catppuccin/nvim",
    opts = function(_, opts)
      opts.transparent_background = true
    end,
  },
  {
    "LazyVim/LazyVim",
    opts = {
      colorscheme = "catppuccin-mocha",
    },
  },
}
