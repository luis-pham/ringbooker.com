#!/usr/bin/env bash
# Same deploy path on VPS as you expect after a clean local: pull → npm ci → build.
# Run from repo root: ./scripts/deploy-app.sh
# Optional: DEPLOY_BRANCH=main (default)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BRANCH="${DEPLOY_BRANCH:-main}"

has_untracked() {
  test -n "$(git ls-files --others --exclude-standard 2>/dev/null)"
}
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null || has_untracked; then
  echo "Working tree was dirty; stashing (including untracked) before pull..."
  git stash push -u -m "deploy-auto-$(date -u +%Y%m%dT%H%M%SZ)"
fi

git pull --rebase origin "$BRANCH"

npm ci
npm run build

if git diff --quiet && git diff --cached --quiet; then
  echo "OK: working tree clean after build (matches committed artifacts)."
else
  echo "WARN: still have local diffs after build — compare with:"
  git status -s
  echo "If only generated prompts / lockfile drift on this server, reset to HEAD:"
  echo "  git restore src/agent/prompts/generated-prompt-packs.ts"
  echo "  git restore package-lock.json"
  echo "Then: git stash drop   (if you do not need the pre-pull stash)"
fi
