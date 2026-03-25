function gpush --wraps='git push origin HEAD'
  git push origin HEAD $argv
end
