# Create a GitHub pull request for the current branch
# Requires: gh CLI (brew install gh)
# Usage:
#   ghpr           - create PR with default settings
#   ghpr --draft   - create draft PR
function ghpr
    if not command -q gh
        echo "Error: gh CLI not installed. Run: brew install gh" >&2
        return 1
    end

    # Push current branch first
    gpush
    or return 1

    # Create PR
    gh pr create --fill $argv
end
