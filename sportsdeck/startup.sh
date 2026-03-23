#!/bin/bash

echo "Installing dependencies..."
npm install

echo "Generating Prisma client..."
npx prisma generate

echo "Running migrations..."
npx prisma migrate deploy

echo "Seeding PL teams and matches..."
node scripts/seed.js

echo "Startup complete!"