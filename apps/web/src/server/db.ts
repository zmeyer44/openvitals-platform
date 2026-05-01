import { createDb, createPgPool, type OpenVitalsDatabase } from "@openvitals/database";

let cached: OpenVitalsDatabase | undefined;

function getDb(): OpenVitalsDatabase {
  if (!cached) cached = createDb(createPgPool());
  return cached;
}

// Proxy that lazily creates the pool on first access. Avoids hard-failing at
// module-load time when DATABASE_URL is not configured.
export const db = new Proxy({} as OpenVitalsDatabase, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  }
});
