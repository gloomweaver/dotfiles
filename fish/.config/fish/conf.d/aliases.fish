# ── Aliases ──────────────────────────────────────────────
# Loaded via conf.d for clean separation from config.fish

alias ls "eza -a --icons --group-directories-first 2>/dev/null; or command ls -A -C -F -G -H"
alias ll "eza -la --icons --group-directories-first 2>/dev/null; or command ls -lAh"
alias lt "eza -a --icons --tree --level=2 --group-directories-first 2>/dev/null; or command ls -R"
alias lg lazygit
alias cat "bat --style=plain 2>/dev/null; or command cat"

# Git shortcuts (prefixed with g)
alias gs "git status -sb"
alias ga "git add"
alias gc "git commit"
alias gd "git diff"
alias gds "git diff --staged"
alias gp "git pull"
alias gl "git log --oneline --graph --decorate -20"
