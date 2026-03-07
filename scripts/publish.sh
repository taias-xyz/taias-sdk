#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ALIAS_DIR="$ROOT_DIR/packages/taias-sdk"

VERSION=$(node -p "require('$ROOT_DIR/package.json').version")

echo "Syncing alias package metadata ..."

# Sync version, dependency pin, and metadata fields from root package.json
node -e "
const fs = require('fs');

const root = JSON.parse(fs.readFileSync('$ROOT_DIR/package.json', 'utf8'));
const alias = JSON.parse(fs.readFileSync('$ALIAS_DIR/package.json', 'utf8'));

alias.version = root.version;
alias.dependencies['@taias/sdk'] = root.version;

const syncFields = ['description', 'keywords', 'homepage', 'license', 'author', 'engines', 'repository'];
for (const field of syncFields) {
  if (root[field] !== undefined) {
    alias[field] = root[field];
  }
}

fs.writeFileSync('$ALIAS_DIR/package.json', JSON.stringify(alias, null, 2) + '\n');
"

# Copy README with alias note appended
cp "$ROOT_DIR/README.md" "$ALIAS_DIR/README.md"
cat >> "$ALIAS_DIR/README.md" << 'EOF'

---

> This package is an alias for [`@taias/sdk`](https://www.npmjs.com/package/@taias/sdk). Both packages are identical — use whichever you prefer.
EOF

echo "Publishing @taias/sdk@$VERSION ..."

# Publish the main package (prepublishOnly in package.json handles the build)
cd "$ROOT_DIR"
npm publish

echo ""
echo "Publishing taias-sdk@$VERSION ..."

# Publish the alias package (no build needed)
cd "$ALIAS_DIR"
npm publish

# Clean up stamped files so git status stays clean
cd "$ROOT_DIR"
git checkout packages/taias-sdk/package.json
rm -f packages/taias-sdk/README.md

echo ""
echo "Done — @taias/sdk@$VERSION and taias-sdk@$VERSION published."
