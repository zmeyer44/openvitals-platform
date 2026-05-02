import { setTimeout } from "node:timers/promises";
import { and, eq } from "drizzle-orm";
import {
  appendImportStatusHistory,
  auditEvents,
  completeJob,
  failJob,
  importJobs,
  leaseNextJob,
  outboxEvents,
  sourceDocuments,
  type OpenVitalsDatabase
} from "@openvitals/database";
import { createObjectStoreFromEnv, processImportJob } from "@openvitals/ingestion";
import { logger } from "./logger";

export type WorkerLoopOptions = {
  db: OpenVitalsDatabase;
  workerId: string;
  signal: AbortSignal;
  pollIntervalMs?: number;
};

export async function runImportWorkerLoop(options: WorkerLoopOptions): Promise<void> {
  const objectStore = createObjectStoreFromEnv();
  const pollIntervalMs = options.pollIntervalMs ?? 1000;

  logger.info({ workerId: options.workerId }, "import worker started");

  while (!options.signal.aborted) {
    const job = await leaseNextJob(options.db, options.workerId, ["import.health_data"]);

    if (!job) {
      await setTimeout(pollIntervalMs, undefined, { signal: options.signal }).catch(() => undefined);
      continue;
    }

    let importJobId: string | null = null;

    try {
      const importJobIdPayload = job.payload.importJobId;
      if (typeof importJobIdPayload !== "string") {
        throw new Error("import.health_data job payload requires importJobId");
      }
      importJobId = importJobIdPayload;

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
      if (importJobId) {
        await markImportFailedAfterWorkerError(options.db, {
          importJobId,
          workerId: options.workerId,
          queueJobId: job.id,
          error
        }).catch((markError) => {
          logger.error(
            {
              workerId: options.workerId,
              jobId: job.id,
              importJobId,
              error: markError instanceof Error ? markError.message : String(markError)
            },
            "failed to mark import domain status after worker error"
          );
        });
      }
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

function safeWorkerErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 1000);
}

async function markImportFailedAfterWorkerError(
  db: OpenVitalsDatabase,
  input: {
    importJobId: string;
    workerId: string;
    queueJobId: string;
    error: unknown;
  }
): Promise<void> {
  const [row] = await db
    .select({ job: importJobs, document: sourceDocuments })
    .from(importJobs)
    .innerJoin(
      sourceDocuments,
      and(
        eq(sourceDocuments.id, importJobs.sourceDocumentId),
        eq(sourceDocuments.ownerUserId, importJobs.ownerUserId)
      )
    )
    .where(eq(importJobs.id, input.importJobId))
    .limit(1);

  if (!row || row.job.status === "failed" || row.job.status === "completed") {
    return;
  }

  const now = new Date();
  const errorCode = "worker_error";
  const errorMessage = safeWorkerErrorMessage(input.error);
  const actor = { type: "worker" as const, id: input.workerId };

  await db.transaction(async (tx) => {
    await tx
      .update(importJobs)
      .set({
        status: "failed",
        errorCode,
        errorMessage,
        completedAt: now,
        updatedAt: now
      })
      .where(eq(importJobs.id, row.job.id));

    await tx
      .update(sourceDocuments)
      .set({
        status: "failed",
        completedAt: now,
        updatedAt: now
      })
      .where(eq(sourceDocuments.id, row.document.id));

    await appendImportStatusHistory(tx, {
      ownerUserId: row.job.ownerUserId,
      importJobId: row.job.id,
      sourceDocumentId: row.document.id,
      fromStatus: row.job.status,
      toStatus: "failed",
      actor,
      reason: "worker_error",
      errorCode,
      metadata: {
        queueJobId: input.queueJobId
      }
    });

    await tx.insert(outboxEvents).values({
      eventType: "import.failed",
      aggregateType: "import_job",
      aggregateId: row.job.id,
      ownerUserId: row.job.ownerUserId,
      actorType: "worker",
      actorId: input.workerId,
      payload: {
        sourceDocumentId: row.document.id,
        errorCode
      }
    });

    await tx.insert(auditEvents).values({
      ownerUserId: row.job.ownerUserId,
      actorType: "worker",
      actorId: input.workerId,
      action: "import.failed",
      resourceType: "import_job",
      resourceId: row.job.id,
      metadata: {
        sourceDocumentId: row.document.id,
        errorCode,
        queueJobId: input.queueJobId
      }
    });
  });
}
