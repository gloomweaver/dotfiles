local status, cmp = pcall(require, "cmp")

if (not status) then
    print("cpm not found")
end

local lspkind = require('lspkind')

cmp.setup({
    snippet = {
        expand = function(args)
            require('luasnip').lsp_expand(args.body)
        end
    },
    mapping = cmp.mapping.preset.insert({
        -- add keymaps
    }),
    sources = cmp.config.sources({{
        name = 'nvim_lsp'
    }, {
        name = 'luasnip'
    }, {
        name = 'buffer'
    }}),
    formatting = {
        format = lspkind.cmp_format({
            with_text = true,
            maxwidth = 50
        })
    }
})

vim.cmd [[
  set completeopt=menuone,noinsert,noselect
  highlight! default link CmpItemKind CmpItemMenuDefault
]]
