function load_env
    set -l env_file $argv[1]
    if not test -f "$env_file"
        echo "Usage: load_env <file>"
        echo "File not found: $env_file"
        return 1
    end
    set -l count 0
    for line in (cat $env_file)
        # Skip empty lines and comments
        if test -z "$line"; or string match -qr '^\s*#' -- $line
            continue
        end
        # Only process lines that look like KEY=VALUE
        if string match -qr '^[A-Za-z_][A-Za-z0-9_]*=' -- $line
            set key (string split -m 1 '=' $line)[1]
            set value (string split -m 1 '=' $line)[2]
            set -gx $key $value
            set count (math $count + 1)
        end
    end
    echo "✓ Loaded $count variables from $env_file"
end
