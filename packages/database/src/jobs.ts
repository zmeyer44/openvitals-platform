import { eq, sql } from "drizzle-orm";
import type { OpenVitalsDatabase } from "./client";
import { jobQueue, type JsonObject } from "./schema";

export type QueuedJob = typeof jobQueue.$inferSelect;

export type EnqueueJobInput = {
  kind: string;
  payload?: JsonObject;
  idempotencyKey?: string;
  runAfter?: Date;
  maxAttempts?: number;
};

type RowsResult<T> = {
  rows: T[];
};

type JobQueueSqlRow = {
  id: string;
  kind: string;
  status: QueuedJob["status"];
  payload: JsonObject;
  idempotency_key: string | null;
  attempts: number;
  max_attempts: number;
  run_after: Date | string;
  locked_by: string | null;
  locked_at: Date | string | null;
  last_error: string | null;
  dead_letter_reason: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function toNullableDate(value: Date | string | null): Date | null {
  return value === null ? null : toDate(value);
}

function mapJobQueueRow(row: JobQueueSqlRow): QueuedJob {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    payload: row.payload,
    idempotencyKey: row.idempotency_key,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    runAfter: toDate(row.run_after),
    lockedBy: row.locked_by,
    lockedAt: toNullableDate(row.locked_at),
    lastError: row.last_error,
    deadLetterReason: row.dead_letter_reason,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at)
  };
}

export async function enqueueJob(
  db: OpenVitalsDatabase,
  input: EnqueueJobInput
): Promise<QueuedJob> {
  const [job] = await db
    .insert(jobQueue)
    .values({
      kind: input.kind,
      payload: input.payload ?? {},
      idempotencyKey: input.idempotencyKey,
      runAfter: input.runAfter ?? new Date(),
      maxAttempts: input.maxAttempts ?? 5
    })
    .onConflictDoUpdate({
      target: jobQueue.idempotencyKey,
      set: {
        payload: input.payload ?? {},
        runAfter: input.runAfter ?? new Date(),
        updatedAt: new Date()
      }
    })
    .returning();

  if (!job) {
    throw new Error("Failed to enqueue job");
  }

  return job;
}

export async function leaseNextJob(
  db: OpenVitalsDatabase,
  workerId: string,
  kinds: string[]
): Promise<QueuedJob | null> {
  if (kinds.length === 0) {
    return null;
  }

  const kindList = sql.join(
    kinds.map((kind) => sql`${kind}`),
    sql`, `
  );

  const result = await db.execute(sql`
    update job_queue
    set
      status = 'running',
      locked_by = ${workerId},
      locked_at = now(),
      attempts = attempts + 1,
      updated_at = now()
    where id = (
      select id
      from job_queue
      where status in ('available', 'retryable')
        and kind in (${kindList})
        and run_after <= now()
      order by run_after asc, created_at asc
      for update skip locked
      limit 1
    )
    returning *
  `);

  const row = ((result as unknown) as RowsResult<JobQueueSqlRow>).rows[0];
  return row ? mapJobQueueRow(row) : null;
}

export async function completeJob(db: OpenVitalsDatabase, jobId: string): Promise<void> {
  await db
    .update(jobQueue)
    .set({
      status: "completed",
      lockedBy: null,
      lockedAt: null,
      lastError: null,
      updatedAt: new Date()
    })
    .where(eq(jobQueue.id, jobId));
}

export async function failJob(
  db: OpenVitalsDatabase,
  job: QueuedJob,
  error: unknown,
  options: { retryDelaySeconds?: number } = {}
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const exhausted = job.attempts >= job.maxAttempts;
  const retryDelaySeconds = options.retryDelaySeconds ?? Math.min(300, 2 ** Math.max(job.attempts, 1));

  await db
    .update(jobQueue)
    .set({
      status: exhausted ? "dead_letter" : "retryable",
      lockedBy: null,
      lockedAt: null,
      lastError: message,
      deadLetterReason: exhausted ? message : null,
      runAfter: exhausted ? job.runAfter : new Date(Date.now() + retryDelaySeconds * 1000),
      updatedAt: new Date()
    })
    .where(eq(jobQueue.id, job.id));
}

export class JobRetryConflictError extends Error {
  constructor(
    message: string,
    public readonly idempotencyKey: string,
    public readonly currentStatus: QueuedJob["status"]
  ) {
    super(message);
    this.name = "JobRetryConflictError";
  }
}

export async function retryJobByIdempotencyKey(
  db: OpenVitalsDatabase,
  input: {
    kind: string;
    idempotencyKey: string;
    payload?: JsonObject;
    runAfter?: Date;
    maxAttempts?: number;
  }
): Promise<QueuedJob> {
  const now = new Date();
  const [job] = await db
    .insert(jobQueue)
    .values({
      kind: input.kind,
      payload: input.payload ?? {},
      idempotencyKey: input.idempotencyKey,
      runAfter: input.runAfter ?? now,
      maxAttempts: input.maxAttempts ?? 5
    })
    .onConflictDoUpdate({
      target: jobQueue.idempotencyKey,
      set: {
        kind: input.kind,
        status: "available",
        payload: input.payload ?? {},
        attempts: 0,
        maxAttempts: input.maxAttempts ?? 5,
        runAfter: input.runAfter ?? now,
        lockedBy: null,
        lockedAt: null,
        lastError: null,
        deadLetterReason: null,
        updatedAt: now
      },
      setWhere: sql`${jobQueue.status} <> 'running'`
    })
    .returning();

  if (job) {
    return job;
  }

  const [existing] = await db
    .select()
    .from(jobQueue)
    .where(eq(jobQueue.idempotencyKey, input.idempotencyKey))
    .limit(1);

  if (existing) {
    throw new JobRetryConflictError(
      `Job ${input.idempotencyKey} is currently ${existing.status} and cannot be retried.`,
      input.idempotencyKey,
      existing.status
    );
  }

  throw new Error("Failed to retry job");
}
