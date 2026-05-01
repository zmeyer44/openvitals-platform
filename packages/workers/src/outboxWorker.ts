import { setTimeout } from "node:timers/promises";
import type { OpenVitalsDatabase } from "@openvitals/database";
import { claimNextOutboxEvent, markOutboxEventFailed, markOutboxEventSent } from "@openvitals/events";
import { logger } from "./logger";

export type OutboxLoopOptions = {
  db: OpenVitalsDatabase;
  workerId: string;
  signal: AbortSignal;
  pollIntervalMs?: number;
};

export async function runOutboxWorkerLoop(options: OutboxLoopOptions): Promise<void> {
  const pollIntervalMs = options.pollIntervalMs ?? 1000;
  logger.info({ workerId: options.workerId }, "outbox worker started");

  while (!options.signal.aborted) {
    const event = await claimNextOutboxEvent(options.db, options.workerId);

    if (!event) {
      await setTimeout(pollIntervalMs, undefined, { signal: options.signal }).catch(() => undefined);
      continue;
    }

    try {
      // Dispatch adapters will live here; for now the durable outbox is acknowledged locally.
      logger.info(
        {
          workerId: options.workerId,
          eventId: event.id,
          eventType: event.eventType,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId
        },
        "outbox event dispatched"
      );
      await markOutboxEventSent(options.db, event.id);
    } catch (error) {
      await markOutboxEventFailed(options.db, event, error);
      logger.error(
        {
          workerId: options.workerId,
          eventId: event.id,
          eventType: event.eventType,
          error: error instanceof Error ? error.message : String(error)
        },
        "outbox event failed"
      );
    }
  }
}
