if status is-interactive
    fish_vi_key_bindings

    # Cursor shapes for vi modes
    set -g fish_cursor_default block
    set -g fish_cursor_insert line
    set -g fish_cursor_replace_one underscore
    set -g fish_cursor_visual block
end
