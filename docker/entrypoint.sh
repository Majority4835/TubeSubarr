#!/bin/sh
set -eu

echo "[tubesubarr] applying prisma schema"
npx prisma db push --skip-generate

echo "[tubesubarr] seeding default users"
npm run seed

echo "[tubesubarr] starting server"
exec node dist/src/server.js
