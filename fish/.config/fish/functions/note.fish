# Quick note-taking — append timestamped notes to a file
# Usage:
#   note                - open notes file in $EDITOR
#   note some text      - append timestamped note
function note
    set -l notes_dir ~/notes
    set -l notes_file "$notes_dir/scratch.md"
    mkdir -p $notes_dir

    if test (count $argv) -eq 0
        $EDITOR $notes_file
    else
        set -l timestamp (date "+%Y-%m-%d %H:%M")
        echo "- [$timestamp] $argv" >> $notes_file
        echo "✓ Note added"
    end
end
