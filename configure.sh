#!/usr/bin/env bash
# Edit these three values, then run ./configure.sh once on a fresh clone.
DB="MY_DB"
SCHEMA="MY_SCHEMA"
WAREHOUSE="MY_WAREHOUSE"

set -euo pipefail
cd "$(dirname "$0")"
if [ "$DB" = "MY_DB" ] || [ "$SCHEMA" = "MY_SCHEMA" ] || [ "$WAREHOUSE" = "MY_WAREHOUSE" ]; then
  echo "Edit DB, SCHEMA and WAREHOUSE at the top of configure.sh first." >&2
  exit 1
fi
FILES="streamlit/snowflake.yml streamlit/streamlit_app.py app-runtime/app.yml app-runtime/lib/constants.ts setup.sql"
for f in $FILES; do
  sed -i.bak -e "s/MY_DB/$DB/g" -e "s/MY_SCHEMA/$SCHEMA/g" -e "s/MY_WAREHOUSE/$WAREHOUSE/g" "$f" && rm "$f.bak"
done
echo "Configured $DB.$SCHEMA with warehouse $WAREHOUSE."
