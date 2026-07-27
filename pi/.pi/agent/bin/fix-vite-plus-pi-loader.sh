#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info() { echo -e "${CYAN}[INFO]${NC} $1"; }
ok() { echo -e "${GREEN}  ✓${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err() { echo -e "${RED}[ERR]${NC} $1"; }

VITE_PLUS_PACKAGES_DIR="${HOME}/.vite-plus/packages"

resolve_from_manifest() {
  local manifest="$1"
  [[ -f "$manifest" ]] || return 1

  local install_id
  install_id="$(grep -oE '"installId"[[:space:]]*:[[:space:]]*"#[^"]+"' "$manifest" | sed -E 's/.*"(#[^"]+)"/\1/' | head -n1)"
  [[ -n "$install_id" ]] || return 1

  local install_dir="${manifest%.json}${install_id}"
  [[ -d "$install_dir" ]] || return 1

  printf '%s\n' "$install_dir"
}

find_install_dir() {
  local manifest
  for manifest in \
    "$VITE_PLUS_PACKAGES_DIR/@earendil-works/pi-coding-agent.json" \
    "$VITE_PLUS_PACKAGES_DIR/@mariozechner/pi-coding-agent.json"
  do
    if resolve_from_manifest "$manifest"; then
      return 0
    fi
  done

  find "$VITE_PLUS_PACKAGES_DIR" -maxdepth 2 -type d \( \
    -path '*/@earendil-works/pi-coding-agent#*' -o \
    -path '*/@mariozechner/pi-coding-agent#*' \
  \) -print 2>/dev/null | sort | tail -n1
}

ensure_stable_symlink() {
  local install_dir="$1"
  local stable_link="${install_dir%%#*}"

  if [[ -e "$stable_link" && ! -L "$stable_link" ]]; then
    local backup="${stable_link}.backup.$(date +%Y%m%d-%H%M%S)"
    mv "$stable_link" "$backup"
    warn "Moved existing package path to $backup"
  fi

  ln -sfn "$install_dir" "$stable_link"
  ok "Updated stable package symlink: $stable_link"
}

patch_loader() {
  local loader="$1"

  [[ -f "$loader" ]] || {
    err "loader.js not found: $loader"
    return 1
  }

  if grep -q 'stableInstallDirCandidate' "$loader"; then
    ok "loader.js already patched"
    return 0
  fi

  local backup="${loader}.bak.vite-plus-fragment-fix"
  if [[ ! -f "$backup" ]]; then
    cp "$loader" "$backup"
    ok "Backed up loader.js to $backup"
  fi

  if command -v python3 >/dev/null 2>&1; then
    python3 - "$loader" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()
old = '''    const packageIndex = path.resolve(__dirname, "../..", "index.js");
    const typeboxEntry = require.resolve("typebox");
    const typeboxCompileEntry = require.resolve("typebox/compile");
    const typeboxValueEntry = require.resolve("typebox/value");
    const packagesRoot = path.resolve(__dirname, "../../../../");
    const resolveWorkspaceOrImport = (workspaceRelativePath, specifier) => {
        const workspacePath = path.join(packagesRoot, workspaceRelativePath);
        if (fs.existsSync(workspacePath)) {
            return workspacePath;
        }
        return fileURLToPath(import.meta.resolve(specifier));
    };
    const piCodingAgentEntry = packageIndex;
    const piAgentCoreEntry = resolveWorkspaceOrImport("agent/dist/index.js", "@earendil-works/pi-agent-core");
    const piTuiEntry = resolveWorkspaceOrImport("tui/dist/index.js", "@earendil-works/pi-tui");
    // Extensions resolve the pi-ai root to the compat entrypoint (a strict
    // superset of the core entrypoint): existing extensions using the old
    // global API keep working at runtime until compat is removed.
    const piAiCompatEntry = resolveWorkspaceOrImport("ai/dist/compat.js", "@earendil-works/pi-ai/compat");
    const piAiOauthEntry = resolveWorkspaceOrImport("ai/dist/oauth.js", "@earendil-works/pi-ai/oauth");
    const piAiProvidersEntry = resolveWorkspaceOrImport("ai/dist/providers/all.js", "@earendil-works/pi-ai/providers/all");
'''
new = '''    const installDir = path.resolve(__dirname, "../../../../../../../");
    const stableInstallDirCandidate = installDir.replace(/pi-coding-agent#[^/]+$/, "pi-coding-agent");
    const stableInstallDir = fs.existsSync(stableInstallDirCandidate) ? stableInstallDirCandidate : installDir;
    const packageRootCandidates = [
        path.join(stableInstallDir, "lib/node_modules/@earendil-works/pi-coding-agent"),
        path.join(stableInstallDir, "lib/node_modules/@mariozechner/pi-coding-agent"),
    ];
    const packageDir = packageRootCandidates.find((candidate) => fs.existsSync(candidate)) ?? packageRootCandidates[0];
    const packageNamespace = packageDir.includes("@mariozechner/") ? "@mariozechner" : "@earendil-works";
    const packageNodeModules = path.join(packageDir, "node_modules");
    const packageIndex = path.join(packageDir, "dist/index.js");
    const typeboxEntry = path.join(packageNodeModules, "typebox/build/index.mjs");
    const typeboxCompileEntry = path.join(packageNodeModules, "typebox/build/compile/index.mjs");
    const typeboxValueEntry = path.join(packageNodeModules, "typebox/build/value/index.mjs");
    const piCodingAgentEntry = packageIndex;
    const piAgentCoreEntry = path.join(packageNodeModules, `${packageNamespace}/pi-agent-core/dist/index.js`);
    const piTuiEntry = path.join(packageNodeModules, `${packageNamespace}/pi-tui/dist/index.js`);
    // Extensions resolve the pi-ai root to the compat entrypoint (a strict
    // superset of the core entrypoint): existing extensions using the old
    // global API keep working at runtime until compat is removed.
    const piAiCompatEntry = path.join(packageNodeModules, `${packageNamespace}/pi-ai/dist/compat.js`);
    const piAiOauthEntry = path.join(packageNodeModules, `${packageNamespace}/pi-ai/dist/oauth.js`);
    const piAiProvidersEntry = path.join(packageNodeModules, `${packageNamespace}/pi-ai/dist/providers/all.js`);
'''
if old not in text:
    raise SystemExit("patch block not found; pi version may have changed")
path.write_text(text.replace(old, new, 1))
PY
  elif command -v node >/dev/null 2>&1; then
    node - "$loader" <<'NODE'
const fs = require('node:fs');
const path = process.argv[2];
const text = fs.readFileSync(path, 'utf8');
const oldBlock = `    const packageIndex = path.resolve(__dirname, "../..", "index.js");
    const typeboxEntry = require.resolve("typebox");
    const typeboxCompileEntry = require.resolve("typebox/compile");
    const typeboxValueEntry = require.resolve("typebox/value");
    const packagesRoot = path.resolve(__dirname, "../../../../");
    const resolveWorkspaceOrImport = (workspaceRelativePath, specifier) => {
        const workspacePath = path.join(packagesRoot, workspaceRelativePath);
        if (fs.existsSync(workspacePath)) {
            return workspacePath;
        }
        return fileURLToPath(import.meta.resolve(specifier));
    };
    const piCodingAgentEntry = packageIndex;
    const piAgentCoreEntry = resolveWorkspaceOrImport("agent/dist/index.js", "@earendil-works/pi-agent-core");
    const piTuiEntry = resolveWorkspaceOrImport("tui/dist/index.js", "@earendil-works/pi-tui");
    // Extensions resolve the pi-ai root to the compat entrypoint (a strict
    // superset of the core entrypoint): existing extensions using the old
    // global API keep working at runtime until compat is removed.
    const piAiCompatEntry = resolveWorkspaceOrImport("ai/dist/compat.js", "@earendil-works/pi-ai/compat");
    const piAiOauthEntry = resolveWorkspaceOrImport("ai/dist/oauth.js", "@earendil-works/pi-ai/oauth");
    const piAiProvidersEntry = resolveWorkspaceOrImport("ai/dist/providers/all.js", "@earendil-works/pi-ai/providers/all");
`;
const newBlock = `    const installDir = path.resolve(__dirname, "../../../../../../../");
    const stableInstallDirCandidate = installDir.replace(/pi-coding-agent#[^/]+$/, "pi-coding-agent");
    const stableInstallDir = fs.existsSync(stableInstallDirCandidate) ? stableInstallDirCandidate : installDir;
    const packageRootCandidates = [
        path.join(stableInstallDir, "lib/node_modules/@earendil-works/pi-coding-agent"),
        path.join(stableInstallDir, "lib/node_modules/@mariozechner/pi-coding-agent"),
    ];
    const packageDir = packageRootCandidates.find((candidate) => fs.existsSync(candidate)) ?? packageRootCandidates[0];
    const packageNamespace = packageDir.includes("@mariozechner/") ? "@mariozechner" : "@earendil-works";
    const packageNodeModules = path.join(packageDir, "node_modules");
    const packageIndex = path.join(packageDir, "dist/index.js");
    const typeboxEntry = path.join(packageNodeModules, "typebox/build/index.mjs");
    const typeboxCompileEntry = path.join(packageNodeModules, "typebox/build/compile/index.mjs");
    const typeboxValueEntry = path.join(packageNodeModules, "typebox/build/value/index.mjs");
    const piCodingAgentEntry = packageIndex;
    const piAgentCoreEntry = path.join(packageNodeModules, `\${packageNamespace}/pi-agent-core/dist/index.js`);
    const piTuiEntry = path.join(packageNodeModules, `\${packageNamespace}/pi-tui/dist/index.js`);
    // Extensions resolve the pi-ai root to the compat entrypoint (a strict
    // superset of the core entrypoint): existing extensions using the old
    // global API keep working at runtime until compat is removed.
    const piAiCompatEntry = path.join(packageNodeModules, `\${packageNamespace}/pi-ai/dist/compat.js`);
    const piAiOauthEntry = path.join(packageNodeModules, `\${packageNamespace}/pi-ai/dist/oauth.js`);
    const piAiProvidersEntry = path.join(packageNodeModules, `\${packageNamespace}/pi-ai/dist/providers/all.js`);
`;
if (!text.includes(oldBlock)) {
  console.error('patch block not found; pi version may have changed');
  process.exit(1);
}
fs.writeFileSync(path, text.replace(oldBlock, newBlock));
NODE
  else
    err "Need python3 or node to patch loader.js"
    return 1
  fi

  ok "Patched loader.js"
}

main() {
  [[ -d "$VITE_PLUS_PACKAGES_DIR" ]] || {
    err "VitePlus packages directory not found: $VITE_PLUS_PACKAGES_DIR"
    exit 1
  }

  local install_dir
  install_dir="$(find_install_dir)"
  [[ -n "$install_dir" ]] || {
    err "Could not find installed pi package under $VITE_PLUS_PACKAGES_DIR"
    exit 1
  }

  info "Using pi install: $install_dir"
  ensure_stable_symlink "$install_dir"

  local loader=""
  local candidate
  for candidate in \
    "$install_dir/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/loader.js" \
    "$install_dir/lib/node_modules/@mariozechner/pi-coding-agent/dist/core/extensions/loader.js"
  do
    if [[ -f "$candidate" ]]; then
      loader="$candidate"
      break
    fi
  done

  [[ -n "$loader" ]] || {
    err "Could not find pi loader.js under $install_dir"
    exit 1
  }

  patch_loader "$loader"

  ok "Pi VitePlus extension-loader workaround is in place"
}

main "$@"
