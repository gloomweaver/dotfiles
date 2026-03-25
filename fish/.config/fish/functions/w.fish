# Git worktree manager
# Usage:
#   w <name>   - create worktree at sibling path
#   w close    - remove current worktree and return to main
function w
    if test (count $argv) -eq 0
        echo "Usage: w <worktree-name> | w close"
        return 1
    end

    set -l cmd $argv[1]

    if test "$cmd" = "close"
        if not git rev-parse --is-inside-work-tree >/dev/null 2>&1
            echo "Error: Not inside a git repository." >&2
            return 1
        end

        set -l current_wt (git rev-parse --show-toplevel)
        set -l main_wt (git worktree list --porcelain | head -n1 | string replace 'worktree ' '')

        if test "$current_wt" = "$main_wt"
            echo "Error: You are in the main worktree. Cannot close." >&2
            return 1
        end

        set -l main_parent (dirname "$main_wt")
        set -l wt_name (string replace "$main_parent/" "" "$current_wt")
        set -l repo_name (basename "$main_wt")

        read -P "Delete worktree '$wt_name' for '$repo_name'? [y/N] " confirm
        if test "$confirm" != "y" -a "$confirm" != "Y"
            echo "Aborted." >&2
            return 0
        end

        cd "$main_wt"

        if git worktree remove "$current_wt"
            echo "✓ Worktree '$wt_name' removed." >&2
        else
            echo "Failed. Use 'git worktree remove --force $current_wt' to force." >&2
            return 1
        end
    else
        set -l wt_name $cmd

        if not git rev-parse --is-inside-work-tree >/dev/null 2>&1
            echo "Error: Not inside a git repository." >&2
            return 1
        end

        set -l repo_root (git rev-parse --show-toplevel)
        set -l parent_dir (dirname "$repo_root")
        set -l path "$parent_dir/$wt_name"

        if test -d "$path"
            echo "Error: Directory '$path' already exists." >&2
            return 1
        end

        # Determine default branch
        set -l default_branch ""
        if git symbolic-ref refs/remotes/origin/HEAD >/dev/null 2>&1
            set default_branch (git symbolic-ref refs/remotes/origin/HEAD | string replace 'refs/remotes/' '')
        else if git rev-parse --verify origin/main >/dev/null 2>&1
            set default_branch "origin/main"
        else if git rev-parse --verify origin/master >/dev/null 2>&1
            set default_branch "origin/master"
        else
            echo "Error: Could not determine default branch." >&2
            return 1
        end

        mkdir -p (dirname "$path")

        echo "Creating worktree at '$path'..." >&2

        if git show-ref --verify --quiet "refs/heads/$wt_name"
            echo "Branch '$wt_name' exists. Checking out..." >&2
            if not git worktree add "$path" "$wt_name" >&2
                echo "Error: Failed to checkout branch '$wt_name'." >&2
                return 1
            end
        else
            echo "Creating branch '$wt_name' from '$default_branch'..." >&2
            if not git worktree add -b "$wt_name" "$path" "$default_branch" >&2
                echo "Error: Failed to create worktree." >&2
                return 1
            end
        end

        # Print the resolved absolute path (for callers like wt)
        pushd "$path" >/dev/null
        echo (pwd)
        popd >/dev/null
    end
end
