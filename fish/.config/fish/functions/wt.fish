# Create git worktree and open a tmux session in it
# Usage: wt <worktree-name>
function wt
    if test (count $argv) -eq 0
        echo "Usage: wt <worktree-name>"
        return 1
    end

    set -l abs_path (w $argv[1])
    or return 1

    set -l session_name $argv[1]

    if tmux has-session -t "=$session_name" 2>/dev/null
        if test -n "$TMUX"
            tmux switch-client -t "=$session_name"
        else
            tmux attach -t "=$session_name"
        end
    else
        if test -n "$TMUX"
            tmux new-session -d -s "$session_name" -c "$abs_path"
            tmux switch-client -t "=$session_name"
        else
            tmux new-session -s "$session_name" -c "$abs_path"
        end
    end
end
