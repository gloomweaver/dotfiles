require('mason').setup()
require('mason-lspconfig').setup({
    ensure_installed = {"lua_ls", "elixirls"}
})

require('lspconfig').lua_ls.setup {}
require('lspconfig').elixirls.setup {
    elixirLS = {
        dialyzerAnabled = true
    }
}
