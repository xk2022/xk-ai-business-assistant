#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Always allocate a fresh Compose project and volume, independent of local data.
project="xk-verify-$(date +%s)-$$"
export POSTGRES_DB=xk_verification POSTGRES_USER=xk_verification
export POSTGRES_PASSWORD="$(node -e 'console.log(require("node:crypto").randomBytes(24).toString("hex"))')"
export POSTGRES_PORT="${TEST_POSTGRES_PORT:-55432}"
export DB_URL="jdbc:postgresql://localhost:${POSTGRES_PORT}/${POSTGRES_DB}"
export DB_USERNAME="$POSTGRES_USER" DB_PASSWORD="$POSTGRES_PASSWORD"
export SPRING_PROFILES_ACTIVE=test
export CORS_ALLOWED_ORIGINS=http://localhost:3000
export NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
export NEXT_TELEMETRY_DISABLED=1
compose=(docker compose -p "$project" -f compose.yml)
cleanup() {
  "${compose[@]}" down
  printf 'Test volume retained: %s_postgres_data\n' "$project"
}
trap cleanup EXIT
"${compose[@]}" config --quiet
"${compose[@]}" up -d --wait postgres
initial_tables=$("${compose[@]}" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
[[ "$initial_tables" == "0" ]] || { echo "Expected blank test database; found $initial_tables public tables" >&2; exit 1; }
printf 'Verified blank database: %s public tables\n' "$initial_tables"
(cd backend/ai-business-assistant && ./mvnw --batch-mode clean verify)
"${compose[@]}" exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c \
  "SHOW server_version; SELECT extname, extversion FROM pg_extension WHERE extname='vector'; SELECT version, description, success FROM flyway_schema_history;"
(cd frontend/app && npm ci && npm run lint && npm run typecheck && npm test && npm run build)
(cd tests/browser && npm ci && npx playwright install chromium && npm test)
