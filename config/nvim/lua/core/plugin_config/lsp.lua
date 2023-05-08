local autocomplete = require('core.plugin_config.autocomplete')

require('mason').setup()
require('mason-lspconfig').setup({
    ensure_installed = {"lua_ls", "elixirls", "tsserver"}
})

require('lspconfig').lua_ls.setup {
    capablities = autocomplete.capablities
}
require('lspconfig').elixirls.setup {
    elixirLS = {
        dialyzerAnabled = true
    },
    capablities = autocomplete.capablities
}
require('lspconfig').tsserver.setup {
    capablities = autocomplete.capablities
}
