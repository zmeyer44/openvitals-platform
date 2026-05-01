import { createDb, createPgPool } from "@openvitals/database";
import { runImportWorkerLoop } from "./importWorker";
import { logger } from "./logger";
import { runOutboxWorkerLoop } from "./outboxWorker";

const workerId = process.env.OPENVITALS_WORKER_ID ?? `worker-${crypto.randomUUID()}`;
const abortController = new AbortController();
const pool = createPgPool();
const db = createDb(pool);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    logger.info({ signal }, "shutdown requested");
    abortController.abort();
  });
}

await Promise.race([
  runImportWorkerLoop({ db, workerId, signal: abortController.signal }),
  runOutboxWorkerLoop({ db, workerId, signal: abortController.signal })
]).finally(async () => {
  abortController.abort();
  await pool.end();
  logger.info({ workerId }, "workers stopped");
});
