-- LSP — language servers for autocomplete, go-to-definition, diagnostics
-- Mason auto-installs the servers so you don't manage them manually
return {
  -- Mason: LSP server installer (like brew but for language servers)
  {
    "mason-org/mason.nvim",
    config = function()
      require("mason").setup()
    end,
  },

  -- Bridge between Mason and nvim's built-in LSP client
  {
    "mason-org/mason-lspconfig.nvim",
    dependencies = {
      "mason-org/mason.nvim",
    },
    config = function()
      require("mason-lspconfig").setup({
        -- Auto-install these servers
        ensure_installed = {
          "lua_ls",         -- Lua
          "ts_ls",          -- TypeScript/JavaScript
          "gopls",          -- Go
          "rust_analyzer",  -- Rust
          "pyright",        -- Python
          "jsonls",         -- JSON
          "yamlls",         -- YAML
          "html",           -- HTML
          "cssls",          -- CSS
          "bashls",         -- Bash
          "elixirls",       -- Elixir
          "tailwindcss",    -- Tailwind CSS
          "clangd",         -- C/C++
        },
      })
    end,
  },

  -- Completion (needed for LSP capabilities)
  {
    "saghen/blink.cmp",
    -- configured in completion.lua, just declare dependency here
  },

  -- LSP configuration using Neovim 0.11 native vim.lsp.config API
  {
    "neovim/nvim-lspconfig",
    event = { "BufReadPre", "BufNewFile" },
    dependencies = {
      "mason-org/mason-lspconfig.nvim",
      "saghen/blink.cmp",
    },
    config = function()
      local inlay_hints_enabled = false

      local function set_inlay_hints(bufnr, enabled)
        if not vim.lsp.inlay_hint then
          return
        end

        vim.lsp.inlay_hint.enable(enabled, { bufnr = bufnr })
      end

      -- Keymaps — only active when an LSP server is attached to the buffer
      vim.api.nvim_create_autocmd("LspAttach", {
        callback = function(event)
          local map = function(keys, func, desc)
            vim.keymap.set("n", keys, func, { buffer = event.buf, desc = "LSP: " .. desc })
          end

          -- Navigation
          map("gd", vim.lsp.buf.definition, "Go to definition")
          map("gD", vim.lsp.buf.declaration, "Go to declaration")
          map("gr", vim.lsp.buf.references, "Go to references")
          map("gi", vim.lsp.buf.implementation, "Go to implementation")
          map("gt", vim.lsp.buf.type_definition, "Go to type definition")

          -- Info
          map("K", vim.lsp.buf.hover, "Hover docs")
          map("<C-s>", vim.lsp.buf.signature_help, "Signature help")

          -- Actions
          map("<leader>ca", vim.lsp.buf.code_action, "Code action")
          map("<leader>cr", vim.lsp.buf.rename, "Rename symbol")
          map("<leader>cf", function() vim.lsp.buf.format({ async = true }) end, "Format file")
          map("<leader>uh", function()
            inlay_hints_enabled = not inlay_hints_enabled
            set_inlay_hints(event.buf, inlay_hints_enabled)
          end, "Toggle inlay hints")

          -- Diagnostics
          map("<leader>cd", vim.diagnostic.open_float, "Line diagnostics")
          map("[d", function() vim.diagnostic.jump({ count = -1 }) end, "Previous diagnostic")
          map("]d", function() vim.diagnostic.jump({ count = 1 }) end, "Next diagnostic")

          set_inlay_hints(event.buf, inlay_hints_enabled)
        end,
      })

      -- Get completion capabilities from blink.cmp
      local capabilities = require("blink.cmp").get_lsp_capabilities()

      -- Configure each server using vim.lsp.config (Neovim 0.11+ native API)
      vim.lsp.config("lua_ls", {
        capabilities = capabilities,
        settings = {
          Lua = {
            workspace = { checkThirdParty = false },
            telemetry = { enable = false },
          },
        },
      })

      vim.lsp.config("ts_ls", {
        capabilities = capabilities,
        settings = {
          typescript = {
            inlayHints = {
              includeInlayParameterNameHints = "literals",
              includeInlayParameterNameHintsWhenArgumentMatchesName = false,
              includeInlayFunctionParameterTypeHints = true,
              includeInlayVariableTypeHints = true,
              includeInlayVariableTypeHintsWhenTypeMatchesName = false,
              includeInlayPropertyDeclarationTypeHints = true,
              includeInlayFunctionLikeReturnTypeHints = true,
              includeInlayEnumMemberValueHints = true,
            },
          },
          javascript = {
            inlayHints = {
              includeInlayParameterNameHints = "literals",
              includeInlayParameterNameHintsWhenArgumentMatchesName = false,
              includeInlayFunctionParameterTypeHints = true,
              includeInlayVariableTypeHints = true,
              includeInlayVariableTypeHintsWhenTypeMatchesName = false,
              includeInlayPropertyDeclarationTypeHints = true,
              includeInlayFunctionLikeReturnTypeHints = true,
              includeInlayEnumMemberValueHints = true,
            },
          },
        },
      })

      vim.lsp.config("gopls", {
        capabilities = capabilities,
        settings = {
          gopls = {
            analyses = { unusedparams = true },
            staticcheck = true,
            hints = {
              assignVariableTypes = true,
              compositeLiteralFields = true,
              compositeLiteralTypes = true,
              constantValues = true,
              functionTypeParameters = true,
              parameterNames = true,
              rangeVariableTypes = true,
            },
          },
        },
      })

      vim.lsp.config("rust_analyzer", {
        capabilities = capabilities,
        settings = {
          ["rust-analyzer"] = {
            inlayHints = {
              bindingModeHints = { enable = true },
              chainingHints = { enable = true },
              closingBraceHints = { enable = true, minLines = 25 },
              closureReturnTypeHints = { enable = "with_block" },
              discriminantHints = { enable = "fieldless" },
              expressionAdjustmentHints = { enable = "always" },
              lifetimeElisionHints = { enable = "skip_trivial", useParameterNames = true },
              parameterHints = { enable = true },
              reborrowHints = { enable = "always" },
              renderColons = true,
              typeHints = { enable = true, hideClosureInitialization = false, hideNamedConstructor = false },
            },
          },
        },
      })
      vim.lsp.config("clangd", {
        capabilities = capabilities,
      })
      vim.lsp.config("pyright", { capabilities = capabilities })
      vim.lsp.config("jsonls", { capabilities = capabilities })
      vim.lsp.config("yamlls", { capabilities = capabilities })
      vim.lsp.config("html", { capabilities = capabilities })
      vim.lsp.config("cssls", { capabilities = capabilities })
      vim.lsp.config("bashls", { capabilities = capabilities })
      vim.lsp.config("elixirls", { capabilities = capabilities })
      vim.lsp.config("tailwindcss", { capabilities = capabilities })

      -- Enable all configured servers
      vim.lsp.enable({
        "lua_ls",
        "ts_ls",
        "gopls",
        "rust_analyzer",
        "clangd",
        "pyright",
        "jsonls",
        "yamlls",
        "html",
        "cssls",
        "bashls",
        "elixirls",
        "tailwindcss",
      })

      -- Diagnostic appearance
      vim.diagnostic.config({
        virtual_text = { spacing = 4, prefix = "●" },
        signs = true,
        underline = true,
        update_in_insert = false,
        severity_sort = true,
        float = { border = "rounded" },
      })
    end,
  },
}
