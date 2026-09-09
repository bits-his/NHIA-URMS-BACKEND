#!/usr/bin/env bash
set -euo pipefail

# Import linkme_db.sql into an Aiven MySQL service.
#
# Required env vars:
#   AIVEN_HOST       e.g. mysql-xxxxx.aivencloud.com
#   AIVEN_PORT       e.g. 12345
#   AIVEN_USER       usually avnadmin
#   AIVEN_PASSWORD   from Aiven console
#   AIVEN_DATABASE   e.g. defaultdb or linkme_db
#   AIVEN_SSL_CA     path to ca.pem downloaded from Aiven
#
# Example:
#   export AIVEN_HOST=mysql-xxxxx.aivencloud.com
#   export AIVEN_PORT=12345
#   export AIVEN_USER=avnadmin
#   export AIVEN_PASSWORD='your-password'
#   export AIVEN_DATABASE=defaultdb
#   export AIVEN_SSL_CA="$HOME/Downloads/ca.pem"
#   ./scripts/import-linkme-to-aiven.sh

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SQL_FILE="$ROOT_DIR/linkme_db.sql"

for var in AIVEN_HOST AIVEN_PORT AIVEN_USER AIVEN_PASSWORD AIVEN_DATABASE AIVEN_SSL_CA; do
  if [[ -z "${!var:-}" ]]; then
    echo "Missing required env var: $var" >&2
    exit 1
  fi
done

if [[ ! -f "$SQL_FILE" ]]; then
  echo "SQL file not found: $SQL_FILE" >&2
  exit 1
fi

if [[ ! -f "$AIVEN_SSL_CA" ]]; then
  echo "CA certificate not found: $AIVEN_SSL_CA" >&2
  exit 1
fi

MYSQL=(mysql
  -u "$AIVEN_USER"
  -p"$AIVEN_PASSWORD"
  -h "$AIVEN_HOST"
  -P "$AIVEN_PORT"
  --ssl-mode=VERIFY_IDENTITY
  --ssl-ca="$AIVEN_SSL_CA"
)

echo "Testing connection to $AIVEN_HOST:$AIVEN_PORT ..."
"${MYSQL[@]}" -e "SELECT 1;" "$AIVEN_DATABASE" 2>/dev/null || \
  "${MYSQL[@]}" -e "CREATE DATABASE IF NOT EXISTS \`$AIVEN_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;"

echo "Resetting target database..."
"${MYSQL[@]}" -e "DROP DATABASE IF EXISTS \`$AIVEN_DATABASE\`; CREATE DATABASE \`$AIVEN_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;"

echo "Importing $SQL_FILE into database '$AIVEN_DATABASE' ..."
{
  echo "SET SESSION sql_require_primary_key=0;"
  sed \
    -e 's/DEFAULT uuid()/DEFAULT (UUID())/g' \
    -e 's/DEFAULT current_timestamp()/DEFAULT CURRENT_TIMESTAMP/g' \
    "$SQL_FILE"
} | "${MYSQL[@]}" "$AIVEN_DATABASE"

echo "Verifying import ..."
"${MYSQL[@]}" "$AIVEN_DATABASE" -e "SHOW TABLES;"
"${MYSQL[@]}" "$AIVEN_DATABASE" -e "SELECT COUNT(*) AS user_count FROM users;"

echo "Import complete."
