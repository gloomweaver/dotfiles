if status is-interactive
    # Commands to run in interactive sessions can go here
end

# ── All setup is in conf.d/ ─────────────────────────────
# 00-paths.fish  — PATH & environment (loads first)
# aliases.fish   — shell aliases
# tools.fish     — starship, zoxide, fzf

# Added by OrbStack: command-line tools and integration
# This won't be added again if you remove it.
source ~/.orbstack/shell/init2.fish 2>/dev/null || :
