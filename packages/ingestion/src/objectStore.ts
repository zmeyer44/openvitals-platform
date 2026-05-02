import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { BlobNotFoundError, del as blobDel, get as blobGet, put as blobPut } from "@vercel/blob";

export type ObjectStorageProvider = "local" | "vercel";

export type ObjectStore = {
  readonly provider: ObjectStorageProvider;
  read(objectKey: string): Promise<Buffer>;
  write(objectKey: string, bytes: Buffer): Promise<void>;
  delete(objectKey: string): Promise<void>;
};

function resolveObjectPath(root: string, objectKey: string): string {
  const rootPath = path.isAbsolute(root) ? root : path.resolve(process.env.INIT_CWD ?? process.cwd(), root);
  const fullPath = path.resolve(rootPath, objectKey);

  if (!fullPath.startsWith(rootPath)) {
    throw new Error("Invalid object key");
  }

  return fullPath;
}

export function createLocalObjectStore(root: string): ObjectStore {
  return {
    provider: "local",
    async read(objectKey) {
      return readFile(resolveObjectPath(root, objectKey));
    },
    async write(objectKey, bytes) {
      const fullPath = resolveObjectPath(root, objectKey);
      await mkdir(path.dirname(fullPath), { recursive: true });
      await writeFile(fullPath, bytes);
    },
    async delete(objectKey) {
      await rm(resolveObjectPath(root, objectKey), { force: true });
    }
  };
}

export type VercelBlobObjectStoreOptions = {
  token?: string | undefined;
  access?: "public" | "private" | undefined;
};

export function createVercelBlobObjectStore(options: VercelBlobObjectStoreOptions = {}): ObjectStore {
  const access = options.access ?? "public";
  const tokenOption = options.token === undefined ? {} : { token: options.token };

  return {
    provider: "vercel",
    async read(objectKey) {
      const result = await blobGet(objectKey, { access, ...tokenOption });
      if (!result) {
        throw new Error(`Blob not found: ${objectKey}`);
      }
      return Buffer.from(await new Response(result.stream).arrayBuffer());
    },
    async write(objectKey, bytes) {
      await blobPut(objectKey, bytes, {
        access,
        addRandomSuffix: false,
        allowOverwrite: true,
        ...tokenOption
      });
    },
    async delete(objectKey) {
      try {
        await blobDel(objectKey, { ...tokenOption });
      } catch (error) {
        if (error instanceof BlobNotFoundError) {
          return;
        }
        throw error;
      }
    }
  };
}

export type ObjectStoreEnv = {
  BLOB_STORAGE_PROVIDER?: string | undefined;
  BLOB_READ_WRITE_TOKEN?: string | undefined;
  BLOB_ACCESS?: string | undefined;
  OPENVITALS_OBJECT_STORAGE_ROOT?: string | undefined;
};

export type CreateObjectStoreFromEnvOptions = {
  env?: ObjectStoreEnv | undefined;
  fallbackLocalRoot?: string | undefined;
};

export function createObjectStoreFromEnv(options: CreateObjectStoreFromEnvOptions = {}): ObjectStore {
  const env = options.env ?? (process.env as ObjectStoreEnv);
  const provider = (env.BLOB_STORAGE_PROVIDER ?? "local").toLowerCase();

  if (provider === "vercel") {
    const token = env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      throw new Error("BLOB_READ_WRITE_TOKEN must be set when BLOB_STORAGE_PROVIDER=vercel");
    }
    const access = env.BLOB_ACCESS === "private" ? "private" : "public";
    return createVercelBlobObjectStore({ token, access });
  }

  if (provider !== "local") {
    throw new Error(`Unknown BLOB_STORAGE_PROVIDER: ${provider}`);
  }

  return createLocalObjectStore(env.OPENVITALS_OBJECT_STORAGE_ROOT ?? options.fallbackLocalRoot ?? ".data/blobs");
}
