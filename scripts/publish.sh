#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ALIAS_DIR="$ROOT_DIR/packages/taias-sdk"

VERSION=$(node -p "require('$ROOT_DIR/package.json').version")

echo "Publishing @taias/sdk@$VERSION ..."

# Sync version and dependency pin to alias package
node -e "
const fs = require('fs');
const path = '$ALIAS_DIR/package.json';
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
pkg.version = '$VERSION';
pkg.dependencies['@taias/sdk'] = '$VERSION';
fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
"

# Build and publish the main package
cd "$ROOT_DIR"
npm run build
npm publish

echo ""
echo "Publishing taias-sdk@$VERSION ..."

# Publish the alias package (no build needed)
cd "$ALIAS_DIR"
npm publish

echo ""
echo "Done — @taias/sdk@$VERSION and taias-sdk@$VERSION published."
