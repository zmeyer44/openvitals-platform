import { Buffer } from "node:buffer";
import { eq } from "drizzle-orm";
import { blobObjects, enqueueJob, importJobs, sourceDocuments, type OpenVitalsDatabase } from "@openvitals/database";
import { buildSourceDocumentObjectKey, sha256Hex } from "@openvitals/domain";
import { createLocalObjectStore } from "@openvitals/ingestion";
import type { AuthenticatedOwnerContext } from "./ownership";

export type CreateImportInput = {
  owner: Pick<AuthenticatedOwnerContext, "ownerUserId" | "actor">;
  fileName: string;
  mimeType: string;
  contentBase64: string;
  idempotencyKey?: string | undefined;
  objectStorageRoot?: string | undefined;
};

export type CreateImportResult = {
  status: "uploaded";
  sourceDocumentId: string;
  importJobId: string;
  objectKey: string;
};

export async function createImport(
  db: OpenVitalsDatabase,
  input: CreateImportInput
): Promise<CreateImportResult> {
  const bytes = Buffer.from(input.contentBase64, "base64");
  const sha256 = sha256Hex(bytes);
  const objectStore = createLocalObjectStore(input.objectStorageRoot ?? process.env.OPENVITALS_OBJECT_STORAGE_ROOT ?? ".data/blobs");
  const ownerUserId = input.owner.ownerUserId;

  const result = await db.transaction(async (tx) => {
    const [sourceDocument] = await tx
      .insert(sourceDocuments)
      .values({
        ownerUserId,
        sourceKind: "file",
        fileName: input.fileName,
        mimeType: input.mimeType,
        sha256,
        status: "uploaded"
      })
      .returning();

    if (!sourceDocument) {
      throw new Error("Failed to create source document");
    }

    const objectKey = buildSourceDocumentObjectKey({
      ownerUserId,
      sourceDocumentId: sourceDocument.id,
      sha256,
      fileName: input.fileName
    });

    await objectStore.write(objectKey, bytes);

    const [blob] = await tx
      .insert(blobObjects)
      .values({
        ownerUserId,
        objectKey,
        sha256,
        mimeType: input.mimeType,
        byteSize: bytes.length
      })
      .returning();

    if (!blob) {
      throw new Error("Failed to create blob object");
    }

    await tx.update(sourceDocuments).set({ blobObjectId: blob.id }).where(eq(sourceDocuments.id, sourceDocument.id));

    const [importJob] = await tx
      .insert(importJobs)
      .values({
        ownerUserId,
        sourceDocumentId: sourceDocument.id,
        status: "uploaded",
        idempotencyKey: input.idempotencyKey ?? `import:${ownerUserId}:${sha256}`
      })
      .returning();

    if (!importJob) {
      throw new Error("Failed to create import job");
    }

    await enqueueJob(tx as unknown as OpenVitalsDatabase, {
      kind: "import.health_data",
      payload: { importJobId: importJob.id },
      idempotencyKey: `job:import.health_data:${importJob.id}`
    });

    return {
      sourceDocumentId: sourceDocument.id,
      importJobId: importJob.id,
      objectKey
    };
  });

  return {
    status: "uploaded",
    ...result
  };
}
