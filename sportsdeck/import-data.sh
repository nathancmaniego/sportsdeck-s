#!/bin/sh
set -e

echo "📥 Importing data..."
node scripts/seed.js
echo "✅ Done."