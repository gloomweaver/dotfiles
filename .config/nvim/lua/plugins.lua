vim.cmd [[packadd packer.nvim]]

return require('packer').startup(function(use)
    use 'wbthomason/packer.nvim'

    -- lsp and autocomplete
    use 'neovim/nvim-lspconfig'
    use 'onsails/lspkind-nvim'
    use 'L3MON4D3/LuaSnip'
    use 'hrsh7th/cmp-nvim-lsp'
    use 'hrsh7th/cmp-buffer'
    use 'hrsh7th/nvim-cmp'
    use 'nvim-treesitter/nvim-treesitter'
end)
