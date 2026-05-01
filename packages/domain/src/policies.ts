import { z } from "zod";
import { recordCategories } from "./types";

export const sharePolicyDraftSchema = z
  .object({
    ownerUserId: z.uuid(),
    recipientUserId: z.uuid().optional(),
    recipientEmail: z.email().optional(),
    categories: z.array(z.enum(recordCategories)).min(1),
    startsAt: z.coerce.date().optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    fromObservedAt: z.coerce.date().nullable().optional(),
    toObservedAt: z.coerce.date().nullable().optional()
  })
  .superRefine((value, ctx) => {
    if (!value.recipientUserId && !value.recipientEmail) {
      ctx.addIssue({
        code: "custom",
        path: ["recipientEmail"],
        message: "A share policy requires either an authenticated recipient or recipient email."
      });
    }

    if (value.expiresAt && value.startsAt && value.expiresAt <= value.startsAt) {
      ctx.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "Share policy expiry must be after the start time."
      });
    }

    if (value.fromObservedAt && value.toObservedAt && value.toObservedAt < value.fromObservedAt) {
      ctx.addIssue({
        code: "custom",
        path: ["toObservedAt"],
        message: "Share policy record window end must be after the start."
      });
    }
  });

export type SharePolicyDraft = z.infer<typeof sharePolicyDraftSchema>;
