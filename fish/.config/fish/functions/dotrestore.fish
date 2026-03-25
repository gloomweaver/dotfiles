# Restore dotfiles from a backup
# Usage:
#   dotrestore         - pick backup interactively with fzf
#   dotrestore <name>  - restore specific backup
function dotrestore
    set -l backup_dir ~/.dotfiles-backups

    if not test -d "$backup_dir"
        echo "No backups found at $backup_dir" >&2
        return 1
    end

    set -l backups (ls -1r $backup_dir 2>/dev/null)
    if test -z "$backups"
        echo "No backups found" >&2
        return 1
    end

    set -l choice
    if test (count $argv) -gt 0
        set choice $argv[1]
    else if command -q fzf
        set choice (printf '%s\n' $backups | fzf --prompt="Restore backup> " --header="Select backup to restore")
    else
        echo "Available backups:"
        printf '  %s\n' $backups
        read -P "Enter backup name: " choice
    end

    if test -z "$choice"
        echo "Cancelled" >&2
        return 1
    end

    set -l backup_path "$backup_dir/$choice"
    if not test -d "$backup_path"
        echo "Backup not found: $choice" >&2
        return 1
    end

    read -P "Restore from '$choice'? This will overwrite current configs. [y/N] " confirm
    if test "$confirm" != "y" -a "$confirm" != "Y"
        echo "Cancelled"
        return 0
    end

    for item in $backup_path/*
        set -l name (basename "$item")
        set -l dest

        switch $name
            case fish ghostty nvim
                set dest ~/.config/$name
            case .tmux.conf
                set dest ~/.$name
            case .aerospace.toml
                set dest ~/.$name
            case '*'
                continue
        end

        if test -n "$dest"
            rm -rf "$dest"
            cp -R "$item" "$dest"
            echo "  Restored $name → $dest"
        end
    end

    echo "✓ Restore complete from $choice"
end
