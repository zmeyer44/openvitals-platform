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

export type ObjectStoreResolver = (input: { storageProvider: string }) => ObjectStore;

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
  token: string;
  access?: "public" | "private" | undefined;
};

function vercelBlobUrlFromToken(token: string, pathname: string, access: "public" | "private"): string {
  // Token format: vercel_blob_rw_<storeId>_<random>
  const storeId = token.split("_")[3];
  if (!storeId) {
    throw new Error("Invalid BLOB_READ_WRITE_TOKEN: cannot extract store ID");
  }
  return `https://${storeId}.${access}.blob.vercel-storage.com/${pathname}`;
}

export function createVercelBlobObjectStore(options: VercelBlobObjectStoreOptions): ObjectStore {
  const access: "public" | "private" = options.access ?? "public";
  const token = options.token;

  return {
    provider: "vercel",
    async read(objectKey) {
      const url = vercelBlobUrlFromToken(token, objectKey, access);
      const result = await blobGet(url, { access, token });
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
        token
      });
    },
    async delete(objectKey) {
      const url = vercelBlobUrlFromToken(token, objectKey, access);
      try {
        await blobDel(url, { token });
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
    return buildVercelStoreFromEnv(env);
  }

  if (provider !== "local") {
    throw new Error(`Unknown BLOB_STORAGE_PROVIDER: ${provider}`);
  }

  return buildLocalStoreFromEnv(env, options.fallbackLocalRoot);
}

export function createObjectStoreResolverFromEnv(
  options: CreateObjectStoreFromEnvOptions = {}
): ObjectStoreResolver {
  const env = options.env ?? (process.env as ObjectStoreEnv);

  let localStore: ObjectStore | undefined;
  let vercelStore: ObjectStore | undefined;

  return ({ storageProvider }) => {
    const provider = storageProvider.toLowerCase();
    if (provider === "local") {
      localStore ??= buildLocalStoreFromEnv(env, options.fallbackLocalRoot);
      return localStore;
    }
    if (provider === "vercel") {
      vercelStore ??= buildVercelStoreFromEnv(env);
      return vercelStore;
    }
    throw new Error(`Unknown storage provider on blob record: ${storageProvider}`);
  };
}

function buildLocalStoreFromEnv(env: ObjectStoreEnv, fallbackRoot: string | undefined): ObjectStore {
  return createLocalObjectStore(env.OPENVITALS_OBJECT_STORAGE_ROOT ?? fallbackRoot ?? ".data/blobs");
}

function buildVercelStoreFromEnv(env: ObjectStoreEnv): ObjectStore {
  const token = env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("BLOB_READ_WRITE_TOKEN must be set to access vercel-stored blobs");
  }
  const access = env.BLOB_ACCESS === "private" ? "private" : "public";
  return createVercelBlobObjectStore({ token, access });
}
