-- Which-key — press Space and wait, see all available keybindings
-- Solves the "I forgot the shortcut" problem
return {
  "folke/which-key.nvim",
  event = "VeryLazy",  -- load after startup (not needed immediately)
  config = function()
    local wk = require("which-key")

    wk.setup({
      delay = 300,  -- ms before popup appears
    })

    -- Register group labels (what shows when you press Space)
    wk.add({
      { "<leader>f", group = "find" },
      { "<leader>s", group = "search" },
      { "<leader>b", group = "buffers" },
      { "<leader>g", group = "git" },
    })
  end,
}
