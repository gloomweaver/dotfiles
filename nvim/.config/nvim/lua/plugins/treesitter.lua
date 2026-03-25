-- Treesitter — real syntax highlighting via parsing, not regex
-- Also powers: smart selection, better indentation
return {
  "nvim-treesitter/nvim-treesitter",
  build = ":TSUpdate",  -- auto-update parsers when plugin updates
  config = function()
    -- Parsers to install automatically
    -- Add languages as you need them
    local ensure_installed = {
      "lua",
      "javascript", "typescript", "tsx",
      "go", "gomod", "gosum",
      "rust",
      "python",
      "html", "css", "json", "yaml", "toml",
      "bash", "fish",
      "markdown", "markdown_inline",
      "gitcommit", "diff",
      "elixir",
      "sql",
      "dockerfile",
      "vim", "vimdoc",
    }

    -- Auto-install missing parsers when entering a buffer
    vim.api.nvim_create_autocmd("FileType", {
      callback = function()
        local ft = vim.bo.filetype
        local lang = vim.treesitter.language.get_lang(ft) or ft
        local ok = pcall(vim.treesitter.language.add, lang)
        if not ok then
          -- Parser not installed, try installing
          pcall(function()
            vim.cmd("TSInstall " .. lang)
          end)
        end
      end,
    })

    -- Install the parsers we want
    require("nvim-treesitter").install(ensure_installed)

    -- Enable treesitter highlighting for all buffers
    vim.api.nvim_create_autocmd("FileType", {
      callback = function()
        pcall(vim.treesitter.start)
      end,
    })
  end,
}
