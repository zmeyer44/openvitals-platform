import { z } from "zod";
import {
  countCanonicalRecordsByBucket,
  listCanonicalRecords,
  type CanonicalBucketCounts,
  type CanonicalRecord,
  type OpenVitalsDatabase
} from "@openvitals/database";
import { canonicalResourceTypes, reviewBuckets } from "@openvitals/domain";
import type { AuthenticatedOwnerContext } from "./ownership";

export const canonicalResourceTypeSchema = z.enum(canonicalResourceTypes);
export const reviewBucketSchema = z.enum(reviewBuckets);

export const listCanonicalRecordsQuerySchema = z.object({
  resourceType: canonicalResourceTypeSchema,
  bucket: reviewBucketSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0)
});

export type ListCanonicalRecordsQuery = z.infer<typeof listCanonicalRecordsQuerySchema>;

export async function listCanonicalRecordsForOwner(
  db: OpenVitalsDatabase,
  input: { owner: Pick<AuthenticatedOwnerContext, "ownerUserId">; query: ListCanonicalRecordsQuery }
): Promise<{ records: CanonicalRecord[]; counts: CanonicalBucketCounts }> {
  const [records, counts] = await Promise.all([
    listCanonicalRecords(db, {
      ownerUserId: input.owner.ownerUserId,
      resourceType: input.query.resourceType,
      bucket: input.query.bucket,
      limit: input.query.limit,
      offset: input.query.offset
    }),
    countCanonicalRecordsByBucket(db, {
      ownerUserId: input.owner.ownerUserId,
      resourceType: input.query.resourceType
    })
  ]);

  return { records, counts };
}
