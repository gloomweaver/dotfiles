function dotsync
  cd ~/dotfiles

  # Standard packages
  set packages fish ghostty tmux nvim aerospace

  # Restow all packages to pick up new files
  for pkg in $packages
    if test -d $pkg
      stow -R $pkg 2>/dev/null
    end
  end

  git add -A

  # Check if there are changes to commit
  if test -z "$(git status --porcelain)"
    echo "✓ Dotfiles synced (nothing to commit)"
    return 0
  end

  git status
  read -P "Commit message: " msg
  if test -n "$msg"
    git commit -m "$msg"
    git push
    echo "✓ Dotfiles synced"
  else
    echo "Cancelled"
  end
end
