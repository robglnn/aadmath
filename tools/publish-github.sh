#!/usr/bin/env bash
# Create (or reuse) the GitHub repo, push, and turn on Pages via Actions.
# Idempotent — safe to re-run.
#
#   gh auth login          # once, interactive
#   tools/publish-github.sh [owner] [repo]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

OWNER="${1:-$(gh api user --jq .login)}"
REPO="${2:-aadmath}"
SLUG="$OWNER/$REPO"

gh auth status >/dev/null 2>&1 || { echo "Not logged in. Run: gh auth login"; exit 1; }

git rev-parse --abbrev-ref HEAD | grep -qx main || git branch -M main

if gh repo view "$SLUG" >/dev/null 2>&1; then
  echo "repo $SLUG already exists — reusing"
  git remote get-url origin >/dev/null 2>&1 \
    && git remote set-url origin "https://github.com/$SLUG.git" \
    || git remote add origin "https://github.com/$SLUG.git"
else
  echo "creating $SLUG"
  gh repo create "$SLUG" --public \
    --description "ASCENT — The Cipher Worlds: an adaptive Algebra I mastery game in Three.js (EN/ES/PL, strict KaTeX)" \
    --source=. --remote=origin
fi

git push -u origin main

# Pages built by the committed Actions workflow, not from a branch.
if gh api "repos/$SLUG/pages" >/dev/null 2>&1; then
  gh api -X PUT "repos/$SLUG/pages" -f build_type=workflow >/dev/null
  echo "pages: already enabled, set to build from the workflow"
else
  gh api -X POST "repos/$SLUG/pages" -f build_type=workflow >/dev/null
  echo "pages: enabled"
fi

gh workflow run pages.yml --repo "$SLUG" >/dev/null 2>&1 || true

cat <<EOF

  repo    https://github.com/$SLUG
  game    https://$OWNER.github.io/$REPO/
  readout https://$OWNER.github.io/$REPO/progress/readout.html
  gallery https://$OWNER.github.io/$REPO/progress/gallery.html

  First deploy takes a couple of minutes. Watch it:
    gh run watch --repo $SLUG
EOF
