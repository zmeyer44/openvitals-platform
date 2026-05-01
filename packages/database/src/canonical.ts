import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { CanonicalResourceType, ReviewBucket } from "@openvitals/domain";
import type { OpenVitalsDbExecutor } from "./client";
import {
  conditions,
  encounters,
  medications,
  observations,
  recordReviewStateEnum
} from "./schema";

type ReviewState = (typeof recordReviewStateEnum.enumValues)[number];

const reviewBucketStates: Record<ReviewBucket, ReviewState[]> = {
  trusted: ["not_required", "confirmed", "corrected"],
  review_needed: ["needs_review"],
  ignored: ["ignored", "merged"],
  unknown: ["unknown"]
};

const canonicalTables = {
  observation: observations,
  condition: conditions,
  medication: medications,
  encounter: encounters
} as const;

export type CanonicalRecord =
  | typeof observations.$inferSelect
  | typeof conditions.$inferSelect
  | typeof medications.$inferSelect
  | typeof encounters.$inferSelect;

export function reviewStatesForBucket(bucket: ReviewBucket): ReviewState[] {
  return reviewBucketStates[bucket];
}

function bucketCondition(column: PgColumn, bucket: ReviewBucket): SQL {
  return inArray(column, reviewStatesForBucket(bucket));
}

export type ListObservationsInput = {
  ownerUserId: string;
  bucket?: ReviewBucket | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
};

export async function listObservations(
  db: OpenVitalsDbExecutor,
  input: ListObservationsInput
): Promise<(typeof observations.$inferSelect)[]> {
  const conditionsList: SQL[] = [eq(observations.ownerUserId, input.ownerUserId)];
  if (input.bucket) {
    conditionsList.push(bucketCondition(observations.reviewState, input.bucket));
  }

  return db
    .select()
    .from(observations)
    .where(and(...conditionsList))
    .orderBy(desc(observations.observedAt), asc(observations.id))
    .limit(input.limit ?? 100)
    .offset(input.offset ?? 0);
}

export async function listConditions(
  db: OpenVitalsDbExecutor,
  input: ListObservationsInput
): Promise<(typeof conditions.$inferSelect)[]> {
  const conditionsList: SQL[] = [eq(conditions.ownerUserId, input.ownerUserId)];
  if (input.bucket) {
    conditionsList.push(bucketCondition(conditions.reviewState, input.bucket));
  }

  return db
    .select()
    .from(conditions)
    .where(and(...conditionsList))
    .orderBy(desc(conditions.onsetAt), asc(conditions.id))
    .limit(input.limit ?? 100)
    .offset(input.offset ?? 0);
}

export async function listMedications(
  db: OpenVitalsDbExecutor,
  input: ListObservationsInput
): Promise<(typeof medications.$inferSelect)[]> {
  const conditionsList: SQL[] = [eq(medications.ownerUserId, input.ownerUserId)];
  if (input.bucket) {
    conditionsList.push(bucketCondition(medications.reviewState, input.bucket));
  }

  return db
    .select()
    .from(medications)
    .where(and(...conditionsList))
    .orderBy(desc(medications.startedAt), asc(medications.id))
    .limit(input.limit ?? 100)
    .offset(input.offset ?? 0);
}

export async function listEncounters(
  db: OpenVitalsDbExecutor,
  input: ListObservationsInput
): Promise<(typeof encounters.$inferSelect)[]> {
  const conditionsList: SQL[] = [eq(encounters.ownerUserId, input.ownerUserId)];
  if (input.bucket) {
    conditionsList.push(bucketCondition(encounters.reviewState, input.bucket));
  }

  return db
    .select()
    .from(encounters)
    .where(and(...conditionsList))
    .orderBy(desc(encounters.startedAt), asc(encounters.id))
    .limit(input.limit ?? 100)
    .offset(input.offset ?? 0);
}

export type ListCanonicalRecordsInput = ListObservationsInput & {
  resourceType: CanonicalResourceType;
};

export async function listCanonicalRecords(
  db: OpenVitalsDbExecutor,
  input: ListCanonicalRecordsInput
): Promise<CanonicalRecord[]> {
  const { resourceType, ...rest } = input;
  switch (resourceType) {
    case "observation":
      return listObservations(db, rest);
    case "condition":
      return listConditions(db, rest);
    case "medication":
      return listMedications(db, rest);
    case "encounter":
      return listEncounters(db, rest);
  }
}

export type CanonicalBucketCounts = Record<ReviewBucket, number>;

export async function countCanonicalRecordsByBucket(
  db: OpenVitalsDbExecutor,
  input: { ownerUserId: string; resourceType: CanonicalResourceType }
): Promise<CanonicalBucketCounts> {
  const table = canonicalTables[input.resourceType];

  const rows = await db
    .select({
      reviewState: table.reviewState,
      count: sql<number>`count(*)::int`.as("count")
    })
    .from(table)
    .where(eq(table.ownerUserId, input.ownerUserId))
    .groupBy(table.reviewState);

  const counts: CanonicalBucketCounts = {
    trusted: 0,
    review_needed: 0,
    ignored: 0,
    unknown: 0
  };

  for (const row of rows) {
    for (const bucket of Object.keys(reviewBucketStates) as ReviewBucket[]) {
      if (reviewBucketStates[bucket].includes(row.reviewState)) {
        counts[bucket] += row.count;
        break;
      }
    }
  }

  return counts;
}

export function canonicalTableFor(resourceType: CanonicalResourceType) {
  return canonicalTables[resourceType];
}
