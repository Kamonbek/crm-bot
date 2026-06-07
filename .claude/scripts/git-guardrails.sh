#!/usr/bin/env bash
# git-guardrails — invoked by Claude Code PreToolUse hooks.
# Reads the proposed Bash command from $CLAUDE_TOOL_INPUT_command (set by the harness).
# Exits 0 to allow, non-zero with a stderr message to block.
set -uo pipefail

cmd="${CLAUDE_TOOL_INPUT_command:-}"
[ -z "$cmd" ] && exit 0

# Configurable: protected branch list (comma-separated, no spaces).
PROTECTED="${GIT_GUARDRAILS_PROTECTED:-main,master,prod}"

block() {
  echo "git-guardrails: blocked — $1" >&2
  echo "  command: $cmd" >&2
  echo "  override: tell the human and have them run the command themselves." >&2
  exit 2
}

# Rule 1: force-push to a protected branch.
if echo "$cmd" | grep -qE 'git[[:space:]]+push.*(--force|--force-with-lease|-f([[:space:]]|$))'; then
  for br in ${PROTECTED//,/ }; do
    if echo "$cmd" | grep -qE "(^|[[:space:]])${br}(\$|[[:space:]:])"; then
      block "force-push to protected branch '$br'"
    fi
  done
fi

# Rule 2: git reset --hard with unstaged / uncommitted work present.
if echo "$cmd" | grep -qE 'git[[:space:]]+reset[[:space:]]+(--hard|--merge[[:space:]]+--hard)'; then
  if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    block "'git reset --hard' would discard uncommitted work (run 'git stash' first if you mean it)"
  fi
fi

# Rule 3: --no-verify on push or commit (skips hooks).
if echo "$cmd" | grep -qE 'git[[:space:]]+(push|commit).*--no-verify'; then
  block "--no-verify skips hooks; fix the underlying lint/test failure instead"
fi

# Rule 4: skipping commit signing.
if echo "$cmd" | grep -qE 'git[[:space:]]+commit.*(--no-gpg-sign|-c[[:space:]]+commit\.gpgsign=false)'; then
  block "commit-signing bypass requested; do not bypass without explicit human direction"
fi

# Rule 5: rm -rf of paths escaping the current working tree.
if echo "$cmd" | grep -qE 'rm[[:space:]]+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r|-rf|-fr)'; then
  paths=$(echo "$cmd" | sed -E 's/^.*rm[[:space:]]+-[a-zA-Z]*[[:space:]]+//; s/[[:space:]]*&&.*//; s/[[:space:]]*\|\|.*//; s/[[:space:]]*;.*//')
  worktree="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
  for p in $paths; do
    case "$p" in
      /*|~*|..*|"$HOME"*) block "'rm -rf' on absolute / home / parent path: $p" ;;
    esac
    abs=$(cd "$(dirname "$p")" 2>/dev/null && pwd)/$(basename "$p") || continue
    case "$abs" in
      "$worktree"*) ;;  # inside worktree — allowed
      *) block "'rm -rf' on path outside worktree ($worktree): $p" ;;
    esac
  done
fi

# Rule 6: git worktree remove --force when worktree has uncommitted changes.
if echo "$cmd" | grep -qE 'git[[:space:]]+worktree[[:space:]]+remove.*--force'; then
  block "'git worktree remove --force' can drop uncommitted work; remove without --force, or commit/stash first"
fi

exit 0
