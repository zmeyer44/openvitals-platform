import { z } from "zod";

export const domainEventTypeSchema = z.enum([
  "import.started",
  "import.failed",
  "import.completed",
  "observation.created",
  "observation.corrected",
  "observation.confirmed",
  "review_task.created",
  "share.created",
  "share.accessed",
  "share.revoked",
  "integration.connected",
  "integration.sync_failed"
]);

export type DomainEventType = z.infer<typeof domainEventTypeSchema>;

export const auditActionSchema = z.enum([
  "import.started",
  "import.failed",
  "import.completed",
  "observation.created",
  "observation.corrected",
  "observation.confirmed",
  "review_task.created",
  "share.created",
  "share.accessed",
  "share.revoked",
  "integration.connected",
  "integration.sync_failed"
]);

export type AuditAction = z.infer<typeof auditActionSchema>;
