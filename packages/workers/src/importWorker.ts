import { setTimeout } from "node:timers/promises";
import { completeJob, failJob, leaseNextJob, type OpenVitalsDatabase } from "@openvitals/database";
import { createLocalObjectStore, processImportJob } from "@openvitals/ingestion";
import { logger } from "./logger";

export type WorkerLoopOptions = {
  db: OpenVitalsDatabase;
  workerId: string;
  signal: AbortSignal;
  pollIntervalMs?: number;
};

export async function runImportWorkerLoop(options: WorkerLoopOptions): Promise<void> {
  const objectStore = createLocalObjectStore(process.env.OPENVITALS_OBJECT_STORAGE_ROOT ?? ".data/blobs");
  const pollIntervalMs = options.pollIntervalMs ?? 1000;

  logger.info({ workerId: options.workerId }, "import worker started");

  while (!options.signal.aborted) {
    const job = await leaseNextJob(options.db, options.workerId, ["import.health_data"]);

    if (!job) {
      await setTimeout(pollIntervalMs, undefined, { signal: options.signal }).catch(() => undefined);
      continue;
    }

    try {
      const importJobId = job.payload.importJobId;
      if (typeof importJobId !== "string") {
        throw new Error("import.health_data job payload requires importJobId");
      }

      const result = await processImportJob({
        db: options.db,
        importJobId,
        objectStore,
        workerId: options.workerId
      });

      await completeJob(options.db, job.id);
      logger.info(
        {
          workerId: options.workerId,
          jobId: job.id,
          importJobId,
          status: result.status,
          reviewTaskCount: result.reviewTaskCount
        },
        "import job processed"
      );
    } catch (error) {
      await failJob(options.db, job, error);
      logger.error(
        {
          workerId: options.workerId,
          jobId: job.id,
          error: error instanceof Error ? error.message : String(error)
        },
        "import job failed"
      );
    }
  }
}
