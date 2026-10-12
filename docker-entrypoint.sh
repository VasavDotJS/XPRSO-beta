#!/bin/sh
set -e

echo "Starting XPRSO Order-Plat..."
if [ -n "$DATABASE_URL" ]; then
  echo "Running database migrations..."
  node -e "
    const { runMigrations } = require('./dist/migrate.js');
    runMigrations().catch(err => {
      console.error('Migration error:', err);
      process.exit(1);
    });
  " || true
fi

echo "Starting Next.js server on port 3000..."
exec node server.js
