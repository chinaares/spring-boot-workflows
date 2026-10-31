#!/usr/bin/env bash
# spring-boot-workflows :: SessionStart hook (command type)
#
# Prints the active / paused workflow state as plain text so the model can
# surface it at session start.
#
# IMPORTANT: this hook MUST stay a command-type hook. Claude Code rejects
# prompt-type hooks for SessionStart events ("prompt-type hooks are not
# supported for SessionStart events (no conversation context is available).
# Use a command-type hook instead.").
#
# Output contract:
#   - .workflows/current-state.md exists -> one "Active workflow:" line
#   - .workflows/paused-*.md exists       -> one "Paused workflow:" line each
#   - nothing found                        -> no output at all

set -uo pipefail

root="${CLAUDE_PROJECT_DIR:-$PWD}"
state="$root/.workflows/current-state.md"

# Read a single key from a YAML frontmatter block.
frontmatter_field() {
  awk -v key="$1" '
    NR == 1 {
      if ($0 !~ /^---[[:space:]]*$/) exit
      in_frontmatter = 1
      next
    }
    in_frontmatter {
      if ($0 ~ /^---[[:space:]]*$/) exit
      i = index($0, ":")
      if (i == 0) next
      k = substr($0, 1, i - 1)
      v = substr($0, i + 1)
      gsub(/^[ \t]+|[ \t]+$/, "", k)
      gsub(/^[ \t]+|[ \t]+$/, "", v)
      if (k == key) { print v; exit }
    }
  ' "$2" 2>/dev/null
}

if [ -f "$state" ]; then
  workflow="$(frontmatter_field workflow "$state")"
  feature="$(frontmatter_field feature "$state")"
  phase="$(frontmatter_field phase "$state")"
  status="$(frontmatter_field status "$state")"

  [ -n "$workflow" ] || workflow="$feature"
  [ -n "$feature" ] || feature="$workflow"

  if [ -n "$workflow$phase" ]; then
    printf 'Active workflow: %s — %s (phase: %s' "$workflow" "$feature" "$phase"
    [ -n "$status" ] && printf ', status: %s' "$status"
    printf '). Use /spring-boot-workflows:resume to continue.\n'
  fi
fi

for file in "$root"/.workflows/paused-*.md; do
  [ -f "$file" ] || continue
  name="$(basename "$file" .md)"
  printf 'Paused workflow: %s. Use /spring-boot-workflows:resume to continue.\n' "${name#paused-}"
done

exit 0
