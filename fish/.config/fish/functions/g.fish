# Quick git - runs status with no args, passes through otherwise
# Usage:
#   g       → git status -sb
#   g add . → git add .
function g
    if test (count $argv) -eq 0
        git status -sb
    else
        git $argv
    end
end
