-- blink.cmp — fast autocompletion engine (Rust-based, replaces nvim-cmp)
return {
  "saghen/blink.cmp",
  version = "1.*",
  event = "InsertEnter",  -- load only when you start typing

  dependencies = {
    -- Snippet engine (needed for LSP snippet expansion)
    { "rafamadriz/friendly-snippets" },
  },

  ---@module 'blink.cmp'
  ---@type blink.cmp.Config
  opts = {
    keymap = {
      -- Readable keymap instead of defaults
      ["<C-j>"] = { "select_next", "fallback" },      -- next item
      ["<C-k>"] = { "select_prev", "fallback" },      -- previous item
      ["<CR>"] = { "accept", "fallback" },             -- confirm selection
      ["<C-e>"] = { "cancel", "fallback" },            -- close menu
      ["<C-space>"] = { "show", "fallback" },          -- trigger manually
      ["<C-d>"] = { "scroll_documentation_down" },     -- scroll docs
      ["<C-u>"] = { "scroll_documentation_up" },       -- scroll docs
      ["<Tab>"] = { "snippet_forward", "fallback" },   -- next snippet placeholder
      ["<S-Tab>"] = { "snippet_backward", "fallback" },-- previous snippet placeholder
    },

    -- What shows in the completion menu
    sources = {
      default = { "lsp", "path", "snippets", "buffer" },
    },

    -- Completion menu appearance
    completion = {
      documentation = {
        auto_show = true,
        auto_show_delay_ms = 200,
      },
      menu = {
        draw = {
          columns = {
            { "kind_icon" },
            { "label", "label_description", gap = 1 },
          },
        },
      },
    },

    -- Nicer icons for completion items
    appearance = {
      nerd_font_variant = "mono",
    },
  },
}
