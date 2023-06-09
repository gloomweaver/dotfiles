local ensure_packer = function()
  local fn = vim.fn
  local install_path = fn.stdpath "data" .. "/site/pack/packer/start/packer.nvim"
  if fn.empty(fn.glob(install_path)) > 0 then
    fn.system { "git", "clone", "--depth", "1", "https://github.com/wbthomason/packer.nvim", install_path }
    vim.cmd [[packadd packer.nvim]]
    return true
  end
  return false
end

local packer_bootstrap = ensure_packer()

return require("packer").startup(function(use)
  use "wbthomason/packer.nvim"
  use "nvim-lua/plenary.nvim"

  -- lsp and autocomplete
  use "williamboman/mason.nvim"
  use "williamboman/mason-lspconfig.nvim"
  use "jose-elias-alvarez/null-ls.nvim"
  use "neovim/nvim-lspconfig"
  use "onsails/lspkind-nvim"
  use "L3MON4D3/LuaSnip"
  use "hrsh7th/cmp-nvim-lsp"
  use "hrsh7th/cmp-buffer"
  use "hrsh7th/nvim-cmp"
  use "nvim-treesitter/nvim-treesitter"
  use {
    "VonHeikemen/lsp-zero.nvim",
    branch = "v2.x",
    requires = { -- LSP Support
      { "neovim/nvim-lspconfig" }, -- Required
      {
        -- Optional
        "williamboman/mason.nvim",
        run = function()
          pcall(vim.cmd, "MasonUpdate")
        end,
      },
      { "williamboman/mason-lspconfig.nvim" }, -- Optional
      -- Autocompletion
      { "hrsh7th/nvim-cmp" }, -- Required
      { "hrsh7th/cmp-nvim-lsp" }, -- Required
      { "L3MON4D3/LuaSnip" }, -- Required
    },
  }
  use {
    "glepnir/lspsaga.nvim",
    opt = true,
    branch = "main",
    event = "LspAttach",
    config = function()
      require("lspsaga").setup {}
    end,
    requires = { { "nvim-tree/nvim-web-devicons" }, { "nvim-treesitter/nvim-treesitter" } },
  }

  -- themes
  use "folke/tokyonight.nvim"
  use "ellisonleao/gruvbox.nvim"
  use "rebelot/kanagawa.nvim"

  -- editor eliments
  use "nvim-tree/nvim-tree.lua"
  use "nvim-tree/nvim-web-devicons"
  use "nvim-lualine/lualine.nvim"
  use {
    "nvim-telescope/telescope.nvim",
    tag = "0.1.1",
    requires = { { "nvim-lua/plenary.nvim" } },
  }
  use {
    "nvim-telescope/telescope-file-browser.nvim",
    requires = { "nvim-telescope/telescope.nvim", "nvim-lua/plenary.nvim" },
  }
  use {
    "nvim-telescope/telescope-fzf-native.nvim",
    run = "cmake -S. -Bbuild -DCMAKE_BUILD_TYPE=Release && cmake --build build --config Release && cmake --install build --prefix build",
  }
  use "github/copilot.vim"
  use "tpope/vim-fugitive"

  if packer_bootstrap then
    require("packer").sync()
  end
end)
