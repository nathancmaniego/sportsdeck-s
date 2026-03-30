#!/bin/sh
set -e

echo "⏳ Running migrations..."
npx prisma migrate deploy

echo "🌱 Seeding database..."
npm run seed

echo "🚀 Starting app..."
npm run dev
