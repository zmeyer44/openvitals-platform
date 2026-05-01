import { eq, sql } from "drizzle-orm";
import type { OpenVitalsDatabase } from "@openvitals/database";
import { auditEvents, outboxEvents, type JsonObject } from "@openvitals/database";
import type { Actor } from "@openvitals/domain";
import { auditActionSchema, domainEventTypeSchema, type AuditAction, type DomainEventType } from "./schemas";

export type OutboxEvent = typeof outboxEvents.$inferSelect;

type RowsResult<T> = {
  rows: T[];
};

type OutboxSqlRow = {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  owner_user_id: string | null;
  actor_type: OutboxEvent["actorType"];
  actor_id: string | null;
  payload: JsonObject;
  metadata: JsonObject;
  status: OutboxEvent["status"];
  attempts: number;
  max_attempts: number;
  available_at: Date | string;
  locked_by: string | null;
  locked_at: Date | string | null;
  processed_at: Date | string | null;
  last_error: string | null;
  created_at: Date | string;
};

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function toNullableDate(value: Date | string | null): Date | null {
  return value === null ? null : toDate(value);
}

function mapOutboxRow(row: OutboxSqlRow): OutboxEvent {
  return {
    id: row.id,
    eventType: row.event_type,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    ownerUserId: row.owner_user_id,
    actorType: row.actor_type,
    actorId: row.actor_id,
    payload: row.payload,
    metadata: row.metadata,
    status: row.status,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    availableAt: toDate(row.available_at),
    lockedBy: row.locked_by,
    lockedAt: toNullableDate(row.locked_at),
    processedAt: toNullableDate(row.processed_at),
    lastError: row.last_error,
    createdAt: toDate(row.created_at)
  };
}

export type EnqueueOutboxEventInput = {
  eventType: DomainEventType;
  aggregateType: string;
  aggregateId: string;
  ownerUserId?: string | null;
  actor: Actor;
  payload?: JsonObject;
  metadata?: JsonObject;
};

export async function enqueueOutboxEvent(
  db: OpenVitalsDatabase,
  input: EnqueueOutboxEventInput
): Promise<OutboxEvent> {
  domainEventTypeSchema.parse(input.eventType);

  const [event] = await db
    .insert(outboxEvents)
    .values({
      eventType: input.eventType,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      ownerUserId: input.ownerUserId ?? null,
      actorType: input.actor.type,
      actorId: input.actor.id ?? null,
      payload: input.payload ?? {},
      metadata: input.metadata ?? {}
    })
    .returning();

  if (!event) {
    throw new Error("Failed to enqueue outbox event");
  }

  return event;
}

export type WriteAuditEventInput = {
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  ownerUserId?: string | null;
  actor: Actor;
  metadata?: JsonObject;
  ipHash?: string | null;
  userAgentHash?: string | null;
};

export async function writeAuditEvent(
  db: OpenVitalsDatabase,
  input: WriteAuditEventInput
): Promise<void> {
  auditActionSchema.parse(input.action);

  await db.insert(auditEvents).values({
    ownerUserId: input.ownerUserId ?? null,
    actorType: input.actor.type,
    actorId: input.actor.id ?? null,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    metadata: input.metadata ?? {},
    ipHash: input.ipHash ?? null,
    userAgentHash: input.userAgentHash ?? null
  });
}

export async function emitAuditedEvent(
  db: OpenVitalsDatabase,
  input: EnqueueOutboxEventInput & {
    auditAction?: AuditAction;
    resourceType?: string;
    resourceId?: string;
  }
): Promise<OutboxEvent> {
  return db.transaction(async (tx) => {
    const event = await enqueueOutboxEvent(tx, input);
    await writeAuditEvent(tx, {
      action: input.auditAction ?? input.eventType,
      resourceType: input.resourceType ?? input.aggregateType,
      resourceId: input.resourceId ?? input.aggregateId,
      ownerUserId: input.ownerUserId ?? null,
      actor: input.actor,
      metadata: input.metadata ?? {}
    });
    return event;
  });
}

export async function claimNextOutboxEvent(
  db: OpenVitalsDatabase,
  workerId: string
): Promise<OutboxEvent | null> {
  const result = await db.execute(sql`
    update outbox_events
    set
      status = 'processing',
      locked_by = ${workerId},
      locked_at = now(),
      attempts = attempts + 1
    where id = (
      select id
      from outbox_events
      where status in ('pending', 'failed')
        and available_at <= now()
      order by available_at asc, created_at asc
      for update skip locked
      limit 1
    )
    returning *
  `);

  const row = ((result as unknown) as RowsResult<OutboxSqlRow>).rows[0];
  return row ? mapOutboxRow(row) : null;
}

export async function markOutboxEventSent(db: OpenVitalsDatabase, eventId: string): Promise<void> {
  await db
    .update(outboxEvents)
    .set({
      status: "sent",
      lockedBy: null,
      lockedAt: null,
      processedAt: new Date(),
      lastError: null
    })
    .where(eq(outboxEvents.id, eventId));
}

export async function markOutboxEventFailed(
  db: OpenVitalsDatabase,
  event: OutboxEvent,
  error: unknown
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const exhausted = event.attempts >= event.maxAttempts;
  const retryDelaySeconds = Math.min(600, 2 ** Math.max(event.attempts, 1));

  await db
    .update(outboxEvents)
    .set({
      status: exhausted ? "dead_letter" : "failed",
      lockedBy: null,
      lockedAt: null,
      lastError: message,
      availableAt: new Date(Date.now() + retryDelaySeconds * 1000)
    })
    .where(eq(outboxEvents.id, event.id));
}
