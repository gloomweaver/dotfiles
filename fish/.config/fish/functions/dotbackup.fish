# Create a timestamped backup of dotfiles state
# Backups go to ~/.dotfiles-backups/
function dotbackup
    set -l backup_dir ~/.dotfiles-backups
    set -l timestamp (date +%Y%m%d-%H%M%S)
    set -l backup_path "$backup_dir/$timestamp"

    mkdir -p "$backup_path"

    # Back up key config files
    set -l targets \
        ~/.config/fish \
        ~/.config/ghostty \
        ~/.config/nvim \
        ~/.tmux.conf \
        ~/.aerospace.toml

    for target in $targets
        if test -e "$target"
            cp -RL "$target" "$backup_path/"(basename "$target") 2>/dev/null
        end
    end

    echo "✓ Backup created at $backup_path"

    # Show recent backups
    set -l count (ls -1 $backup_dir 2>/dev/null | wc -l | string trim)
    echo "  Total backups: $count"
end
