// The test suite exercises apps/api's in-memory fallback path (no seeded
// Postgres fixture exists for CI/local test runs). Importing @prisma/client
// auto-loads a root .env as a side effect and would otherwise leak a
// developer's local DATABASE_URL into the tests, making them depend on
// whatever is (or isn't) seeded in that database.
//
// Set to "" rather than deleted: dotenv (which @prisma/client's import
// triggers) only fills in keys that are *absent* from process.env, so an
// empty string here survives that later auto-load instead of being silently
// repopulated from .env.
process.env.DATABASE_URL = "";
