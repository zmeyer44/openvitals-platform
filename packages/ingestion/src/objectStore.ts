import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export type ObjectStore = {
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
