-- Gitsigns — git status in the gutter + inline blame + hunk actions
return {
  "lewis6991/gitsigns.nvim",
  event = { "BufReadPre", "BufNewFile" },
  config = function()
    require("gitsigns").setup({
      signs = {
        add          = { text = "▎" },
        change       = { text = "▎" },
        delete       = { text = "▁" },
        topdelete    = { text = "▔" },
        changedelete = { text = "▎" },
      },
      -- Show blame at end of line (dimmed)
      current_line_blame = true,
      current_line_blame_opts = {
        delay = 500,
        virt_text_pos = "eol",
      },
      current_line_blame_formatter = "  <author>, <author_time:%R> — <summary>",

      on_attach = function(bufnr)
        local gs = require("gitsigns")
        local map = function(mode, keys, func, desc)
          vim.keymap.set(mode, keys, func, { buffer = bufnr, desc = "Git: " .. desc })
        end

        -- Navigation between hunks (changed blocks)
        map("n", "]h", function() gs.nav_hunk("next") end, "Next hunk")
        map("n", "[h", function() gs.nav_hunk("prev") end, "Previous hunk")

        -- Stage / undo
        map("n", "<leader>gs", gs.stage_hunk, "Stage hunk")
        map("n", "<leader>gu", gs.undo_stage_hunk, "Undo stage hunk")
        map("n", "<leader>gr", gs.reset_hunk, "Reset hunk")
        map("v", "<leader>gs", function() gs.stage_hunk({ vim.fn.line("."), vim.fn.line("v") }) end, "Stage selection")
        map("v", "<leader>gr", function() gs.reset_hunk({ vim.fn.line("."), vim.fn.line("v") }) end, "Reset selection")

        -- Buffer-level
        map("n", "<leader>gS", gs.stage_buffer, "Stage entire file")
        map("n", "<leader>gR", gs.reset_buffer, "Reset entire file")

        -- View
        map("n", "<leader>gp", gs.preview_hunk, "Preview hunk")
        map("n", "<leader>gb", gs.blame_line, "Blame line (full)")
        map("n", "<leader>gd", gs.diffthis, "Diff against index")
      end,
    })
  end,
}
