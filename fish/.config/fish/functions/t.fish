# Tmux session picker - start/recover/connect
# Usage:
#   t        - pick existing session or create 'main'
#   t .      - new session in current directory (named after folder)
#   t <name> - new session with given name in current directory
function t
  # Handle arguments: create new session in current directory
  if test (count $argv) -gt 0
    set arg $argv[1]

    if test "$arg" = "."
      set session_name (basename $PWD)
    else
      set session_name $arg
    end

    # Attach if session exists, create otherwise
    if tmux has-session -t "=$session_name" 2>/dev/null
      if test -n "$TMUX"
        tmux switch-client -t "=$session_name"
      else
        tmux attach -t "=$session_name"
      end
    else
      if test -n "$TMUX"
        tmux new-session -d -s "$session_name" -c "$PWD"
        tmux switch-client -t "=$session_name"
      else
        tmux new-session -s "$session_name" -c "$PWD"
      end
    end
    return
  end

  # No arguments — show session picker

  # Ensure tmux server is running
  tmux start-server 2>/dev/null

  # Trigger resurrect restore if no sessions exist
  if test -z "$(tmux list-sessions 2>/dev/null)"
    tmux new-session -d -s _restore 2>/dev/null
    tmux run-shell ~/.tmux/plugins/tmux-resurrect/scripts/restore.sh 2>/dev/null
    sleep 1
    tmux kill-session -t _restore 2>/dev/null
  end

  # Get tmux sessions
  set sessions (tmux list-sessions -F "#{session_name}|#{session_windows} windows|#{?session_attached,attached,}" 2>/dev/null)

  if test -z "$sessions"
    echo "No sessions found. Creating 'main'..."
    tmux new-session -s main
    return
  end

  # Format for fzf
  set formatted
  for s in $sessions
    set parts (string split "|" $s)
    set name $parts[1]
    set windows $parts[2]
    set attached $parts[3]
    if test -n "$attached"
      set formatted $formatted "$name|$windows ●"
    else
      set formatted $formatted "$name|$windows"
    end
  end

  # Add option to create new session
  set current_dir (basename $PWD)
  set formatted "+ new: $current_dir|in $PWD" $formatted

  # Pick with fzf
  set choice (printf '%s\n' $formatted | fzf --ansi --no-sort --prompt="tmux> " --header="Select session (or create new)" --delimiter="|" --with-nth=1,2)

  if test -n "$choice"
    if string match -q "+ new:*" "$choice"
      if test -n "$TMUX"
        tmux new-session -d -s "$current_dir" -c "$PWD"
        tmux switch-client -t "=$current_dir"
      else
        tmux new-session -s "$current_dir" -c "$PWD"
      end
    else
      set session_name (echo $choice | sed 's/|.*//')
      if test -n "$TMUX"
        tmux switch-client -t "=$session_name"
      else
        tmux attach -t "=$session_name"
      end
    end
  end
end
