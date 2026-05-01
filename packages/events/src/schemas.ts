import { z } from "zod";

export const domainEventTypeSchema = z.enum([
  "import.started",
  "import.failed",
  "import.completed",
  "observation.created",
  "review_task.created",
  "review_task.resolved",
  "record.confirmed",
  "record.corrected",
  "record.ignored",
  "record.merged",
  "record.marked_unknown",
  "record.note_attached",
  "share.created",
  "share.accessed",
  "share.revoked",
  "integration.connected",
  "integration.sync_failed",
  "intake.started",
  "intake.step_saved",
  "intake.step_skipped",
  "intake.completed"
]);

export type DomainEventType = z.infer<typeof domainEventTypeSchema>;

export const auditActionSchema = z.enum([
  "import.started",
  "import.failed",
  "import.completed",
  "observation.created",
  "review_task.created",
  "review_task.resolved",
  "record.confirmed",
  "record.corrected",
  "record.ignored",
  "record.merged",
  "record.marked_unknown",
  "record.note_attached",
  "share.created",
  "share.accessed",
  "share.revoked",
  "integration.connected",
  "integration.sync_failed",
  "intake.started",
  "intake.step_saved",
  "intake.step_skipped",
  "intake.completed"
]);

export type AuditAction = z.infer<typeof auditActionSchema>;
