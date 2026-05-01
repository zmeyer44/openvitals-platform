import { Buffer } from "node:buffer";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { createDb, type OpenVitalsDatabase } from "../packages/database/src/client";
import {
  appUsers,
  authAccounts,
  authSessions,
  authUsers,
  blobObjects,
  importJobs,
  jobQueue,
  sourceDocuments
} from "../packages/database/src/schema";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!databaseUrl && process.env.CI) {
  throw new Error("TEST_DATABASE_URL or DATABASE_URL is required for auth ownership integration tests in CI.");
}

const describeWithDatabase = databaseUrl ? describe.sequential : describe.skip;

let pool: Pool;
let db: OpenVitalsDatabase;
let objectStorageRoot: string;

const tableNames = [
  "audit_events",
  "outbox_events",
  "review_tasks",
  "record_revisions",
  "provenance",
  "observations",
  "conditions",
  "medications",
  "encounters",
  "source_records",
  "file_classifications",
  "import_status_history",
  "import_jobs",
  "source_documents",
  "blob_objects",
  "share_policy_scopes",
  "share_policies",
  "intake_answers",
  "intake_workflows",
  "integrations",
  "integration_webhook_events",
  "user_profiles",
  "job_queue",
  "app_users",
  "auth_accounts",
  "auth_sessions",
  "auth_verifications",
  "auth_users"
];

async function truncateAllTables(): Promise<void> {
  await pool.query(`truncate table ${tableNames.join(", ")} restart identity cascade`);
}

describeWithDatabase("authentication and ownership integration", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
    process.env.BETTER_AUTH_SECRET ??= "test-better-auth-secret-with-enough-entropy-for-openvitals";

    pool = new Pool({ connectionString: databaseUrl, max: 1 });
    db = createDb(pool);
    objectStorageRoot = await mkdtemp(join(tmpdir(), "openvitals-imports-"));
    await pool.query("select 1");
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  afterAll(async () => {
    await pool?.end();
    if (objectStorageRoot) {
      await rm(objectStorageRoot, { recursive: true, force: true });
    }
  });

  it("uses Better Auth sign-up as the identity source and creates an OpenVitals owner", async () => {
    const { auth } = await import("../apps/web/src/server/auth");

    const response = await auth.handler(
      new Request("http://localhost:3000/api/auth/sign-up/email", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000"
        },
        body: JSON.stringify({
          email: "alex.auth@example.test",
          password: "correct-horse-battery-staple",
          name: "Alex Auth"
        })
      })
    );

    expect(response.status).toBe(200);

    const [authUser] = await db.select().from(authUsers).where(eq(authUsers.email, "alex.auth@example.test")).limit(1);
    expect(authUser?.name).toBe("Alex Auth");

    const [account] = await db.select().from(authAccounts).where(eq(authAccounts.userId, authUser?.id ?? "")).limit(1);
    expect(account?.providerId).toBe("credential");

    const [session] = await db.select().from(authSessions).where(eq(authSessions.userId, authUser?.id ?? "")).limit(1);
    expect(session?.token).toBeTruthy();

    const [appUser] = await db.select().from(appUsers).where(eq(appUsers.externalAuthId, authUser?.id ?? "")).limit(1);
    expect(appUser?.email).toBe("alex.auth@example.test");
    expect(appUser?.role).toBe("user");
  });

  it("derives ownerUserId from the authenticated owner context when creating imports", async () => {
    await db.insert(authUsers).values({
      id: "auth-import-owner",
      name: "Import Owner",
      email: "import-owner@example.test",
      emailVerified: true
    });

    const { createOwnerContextForAuthUser } = await import("../apps/web/src/server/ownership");
    const { createImport } = await import("../apps/web/src/server/imports");
    const owner = await createOwnerContextForAuthUser(
      {
        id: "auth-import-owner",
        email: "import-owner@example.test",
        name: "Import Owner"
      },
      db
    );

    const result = await createImport(db, {
      owner,
      fileName: "labs.csv",
      mimeType: "text/csv",
      content: Buffer.from("test_name,value,unit\nHemoglobin,13.2,g/dL\n"),
      idempotencyKey: "auth-import-owner:labs",
      objectStorageRoot
    });

    const [document] = await db
      .select()
      .from(sourceDocuments)
      .where(eq(sourceDocuments.id, result.sourceDocumentId))
      .limit(1);
    const [job] = await db.select().from(importJobs).where(eq(importJobs.id, result.importJobId)).limit(1);
    const [blob] = await db.select().from(blobObjects).where(eq(blobObjects.id, document?.blobObjectId ?? "")).limit(1);
    const [queued] = await db.select().from(jobQueue).where(eq(jobQueue.idempotencyKey, `job:import.health_data:${job?.id}`)).limit(1);

    expect(document?.ownerUserId).toBe(owner.ownerUserId);
    expect(job?.ownerUserId).toBe(owner.ownerUserId);
    expect(blob?.ownerUserId).toBe(owner.ownerUserId);
    expect(blob?.objectKey).toContain(`users/${owner.ownerUserId}/source-documents/by-sha256/`);
    expect(queued?.payload).toEqual({ importJobId: job?.id });
  });
});
