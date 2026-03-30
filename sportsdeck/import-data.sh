#!/bin/sh
set -e

echo "📥 Importing data..."
npm run seed
echo "✅ Done."