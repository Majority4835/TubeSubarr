#!/bin/sh
set -eu

echo "[tubsubarr] applying prisma schema"
npx prisma db push --skip-generate

echo "[tubsubarr] seeding default users"
npm run seed

echo "[tubsubarr] starting server"
exec node dist/src/server.js
