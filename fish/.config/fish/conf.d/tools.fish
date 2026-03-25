# ── Tool integrations ────────────────────────────────────
# Loaded via conf.d — each tool inits only if present

# Starship prompt
if status is-interactive && command -q starship
    starship init fish | source
end

# fzf — handled by patrickf1/fzf.fish plugin (conf.d/fzf.fish)
# Provides: Ctrl+R (history), Ctrl+Alt+F (files), Ctrl+Alt+L (git log),
#           Ctrl+Alt+S (git status), Ctrl+Alt+P (processes), Ctrl+V (variables)

# zoxide (smart cd)
if command -q zoxide
    zoxide init --cmd cd fish | source
end
