function branch --wraps='git checkout -b'
  git checkout -b $argv
end
