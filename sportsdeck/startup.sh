#!/bin/sh
set -e

echo "⏳ Running migrations..."
npx prisma migrate deploy

echo "🌱 Seeding database..."
node scripts/seed.js

echo "🚀 Starting app..."
npm run dev
