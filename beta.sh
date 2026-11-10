#!/usr/bin/env bash
# Build and serve a beta preview of the current working tree.
#
# A beta is a preview, never a release. It keeps the app version and the
# offline cache name at 3.0, never touches tags and never publishes anywhere.
# The copy lives in beta-build/ (gitignored), is marked as beta in the page,
# and has service-worker registration removed so a preview can never cache
# itself or overwrite the 3.0 offline shell.

set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
OUT="$ROOT/beta-build"
PORT="${PORT:-4173}"
SERVE=1

usage() {
  cat <<'EOF'
Build a beta preview of the current working tree, then serve it locally.

  ./beta.sh              build into beta-build/ and serve on http://localhost:4173
  ./beta.sh --build      build only
  ./beta.sh --port 5000  serve on another port (or set PORT)

A beta never changes the app version, the offline cache name, tags or the
published 3.0 release. beta-build/ is gitignored and is not deployed.
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --build) SERVE=0 ;;
    --serve) SERVE=1 ;;
    --port) PORT="${2:?--port needs a number}"; shift ;;
    --port=*) PORT="${1#*=}" ;;
    --help|-h) usage; exit 0 ;;
    *) echo "beta.sh: unknown option $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

if ! git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  echo "beta.sh: run this from the Sixfold repository" >&2
  exit 1
fi

SHA=$(git -C "$ROOT" rev-parse --short HEAD)
DIRTY=""
if [ -n "$(git -C "$ROOT" status --porcelain)" ]; then
  DIRTY=" · dirty"
fi
STAMP="$SHA$DIRTY · $(date -u '+%Y-%m-%d %H:%M UTC')"

echo "beta.sh: building preview from $SHA$DIRTY"
rm -rf "$OUT"
mkdir -p "$OUT"
( cd "$ROOT" && tar -cf - \
    --exclude=.git \
    --exclude=artifacts \
    --exclude=beta-build \
    --exclude=node_modules \
    --exclude=.freebuff \
    --exclude='.env' \
    --exclude='.env.*' \
    . ) | ( cd "$OUT" && tar -xf - )

python3 - "$OUT/index.html" "$STAMP" <<'PY'
import re
import sys
from html import escape

path, stamp = sys.argv[1], sys.argv[2]
with open(path, encoding='utf-8') as handle:
    page = handle.read()


def sub(pattern, build, message):
    global page
    page, count = re.subn(pattern, build, page, count=1)
    if count != 1:
        sys.exit('beta.sh: ' + message)


sub(r'<html\b', lambda m: '<html data-beta="1"', 'could not mark the html element')
sub(
    r'<head(\s[^>]*)?>',
    lambda m: m.group(0) + '\n  <meta name="robots" content="noindex, nofollow" />',
    'could not add the robots meta tag'
)
sub(r'</title>', lambda m: ' · beta</title>', 'could not suffix the title')
sub(
    r"navigator\.serviceWorker\.register\('sw\.js'\)",
    lambda m: '/* beta preview: service worker disabled */',
    'could not disable the service worker registration'
)
sub(
    r'aria-label="Sixfold version 3\.0"',
    lambda m: 'aria-label="Sixfold 3.0 beta preview"',
    'could not label the version for screen readers'
)
sub(
    r'<p class="hub-version"[^>]*>v3\.0</p>',
    lambda m: m.group(0)[:-4] + ' <span class="beta-flag" title="Beta preview · '
    + escape(stamp) + '">beta</span></p>',
    'could not tag the version label'
)
sub(
    r'</head>',
    lambda m: (
        '<style id="beta-preview-style">\n'
        '  .beta-flag { margin-left: 6px; padding: 2px 5px; border: 1px solid currentColor;'
        ' border-radius: 4px; font-size: 8px; font-weight: 700; letter-spacing: 0.1em;'
        ' line-height: 1.1; text-transform: uppercase; vertical-align: 1px; }\n'
        '</style>\n</head>'
    ),
    'could not add the beta style'
)
sub(
    r'</body>',
    lambda m: (
        '<script>\n'
        '  (function () {\n'
        "    var suffix = ' · beta';\n"
        '    function mark() {\n'
        '      if (document.title.indexOf(suffix) === -1) document.title += suffix;\n'
        '    }\n'
        "    var title = document.querySelector('title');\n"
        "    if (title && 'MutationObserver' in window) {\n"
        '      new MutationObserver(mark).observe(title, { childList: true });\n'
        '    }\n'
        '    mark();\n'
        '  })();\n'
        '</script>\n</body>'
    ),
    'could not keep the beta title suffix'
)

with open(path, 'w', encoding='utf-8') as handle:
    handle.write(page)
PY

echo "beta.sh: preview ready in beta-build/ ($STAMP)"
if [ "$SERVE" -eq 0 ]; then
  echo "beta.sh: serve it with: python3 -m http.server 4173 --bind 127.0.0.1 --directory beta-build"
  exit 0
fi
echo "beta.sh: serving on http://localhost:$PORT (Ctrl+C to stop)"
exec python3 -m http.server "$PORT" --bind 0.0.0.0 --directory "$OUT"
