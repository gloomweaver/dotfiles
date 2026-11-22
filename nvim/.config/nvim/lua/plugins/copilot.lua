-- GitHub Copilot — inline AI code completion (ghost text)
-- First run: `:Copilot auth` to sign in with GitHub (needs Copilot enabled on the account)
-- The plugin downloads its own Copilot server binary on first use (no Node.js needed)
return {
  "zbirenbaum/copilot.lua",
  cmd = "Copilot",
  event = "InsertEnter",
  opts = {
    suggestion = {
      auto_trigger = true,  -- suggest as you type
      keymap = {
        -- No Alt keys (AeroSpace/tmux grab them); not Tab/<C-j> (blink.cmp uses those)
        accept = "<C-l>",       -- accept whole suggestion
        accept_word = "<C-g>",  -- accept next word
        accept_line = false,
        next = false,
        prev = false,
        dismiss = "<C-]>",
      },
    },
    panel = { enabled = false },
    filetypes = {
      markdown = true,
      gitcommit = true,
    },
  },
}
