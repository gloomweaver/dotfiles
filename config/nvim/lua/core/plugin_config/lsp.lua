local lsp = require("lsp-zero")
local cmp = require("cmp")

lsp.preset("recommended")

lsp.ensure_installed({ "tsserver", "eslint_d", "prettierd", "lua_ls", "elixirls", "rust_analyzer" })

lsp.on_attach(function(client, bufnr)
	lsp.default_keymaps({
		buffer = bufnr,
	})

	vim.keymap.set({ "n", "x" }, "gq", function()
		vim.lsp.buf.format({
			async = false,
			timeout_ms = 10000,
		})
	end)
end)

lsp.format_on_save({
	format_opts = {
		timeout_ms = 10000,
	},
	servers = {
		["null-ls"] = { "javascript", "typescript", "lua" },
	},
})

lsp.setup()

local null_ls = require("null-ls")

null_ls.setup({
	sources = {
		null_ls.builtins.formatting.prettierd,
		null_ls.builtins.diagnostics.eslint_d,
		null_ls.builtins.formatting.stylua,
	},
})

cmp.setup({
	mapping = {
		-- `Enter` key to confirm completion
		["<CR>"] = cmp.mapping.confirm({
			select = false,
		}),
	},
})
