local lsp = require('lsp-zero')

lsp.preset('recommended')

lsp.ensure_installed({"tsserver", "eslint_d", "prettierd", "lua_ls", "elixirls", "rust_analyzer"})

local null_ls = require('null-ls')

null_ls.setup({
    sources = {null_ls.builtins.formatting.prettierd, null_ls.builtins.diagnostics.eslint_d,
               null_ls.builtins.formatting.stylua}
})

lsp.format_on_save({
    format_opts = {
        timeout_ms = 10000
    },
    servers = {
        ['null-ls'] = {'javascript', 'typescript', 'lua'}
    }
})

lsp.setup()

