import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getRuntimeConfig } from "@/lib/runtime-config";

export type StoredArtifact = {
  storageKey: string;
  checksum: string;
  byteSize: number;
  contentType: string;
};

export interface ArtifactStorage {
  put(
    key: string,
    bytes: Uint8Array,
    contentType: string
  ): Promise<StoredArtifact>;
  get(key: string): Promise<Uint8Array | null>;
  mode(): "local" | "vercel-blob" | "memory";
}

const memoryStore = new Map<string, Uint8Array>();

export function createMemoryStorage(): ArtifactStorage {
  return {
    mode: () => "memory",
    async put(key, bytes, contentType) {
      memoryStore.set(key, bytes);
      return {
        storageKey: key,
        checksum: createHash("sha256").update(bytes).digest("hex"),
        byteSize: bytes.byteLength,
        contentType,
      };
    },
    async get(key) {
      return memoryStore.get(key) ?? null;
    },
  };
}

function createLocalStorage(
  root = path.join(process.cwd(), ".data", "artifacts")
): ArtifactStorage {
  return {
    mode: () => "local",
    async put(key, bytes, contentType) {
      const filePath = path.join(root, key);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, bytes);
      return {
        storageKey: key,
        checksum: createHash("sha256").update(bytes).digest("hex"),
        byteSize: bytes.byteLength,
        contentType,
      };
    },
    async get(key) {
      try {
        return await readFile(path.join(root, key));
      } catch {
        return null;
      }
    },
  };
}

export function getArtifactStorage(): ArtifactStorage {
  const config = getRuntimeConfig();
  if (config.storage.mode === "vercel-blob") {
    // Production adapter: private blob put/get. Without a live token, refuse local fallback.
    if (!("token" in config.storage) || !config.storage.token) {
      throw new Error(
        "PRIVATE_STORAGE_MODE=vercel-blob requires BLOB_READ_WRITE_TOKEN."
      );
    }
    const token = config.storage.token;
    return {
      mode: () => "vercel-blob",
      async put(key, bytes, contentType) {
        // Dynamic package name avoids build-time resolution of optional @vercel/blob.
        const packageName = ["@vercel", "blob"].join("/");
        let mod: {
          put: (
            pathname: string,
            body: Buffer,
            opts: Record<string, unknown>
          ) => Promise<{ pathname?: string; url?: string }>;
        };
        try {
          mod = require(packageName);
        } catch {
          throw new Error(
            "vercel-blob storage requires @vercel/blob and a valid private blob token; refusing local fallback."
          );
        }
        const result = await mod.put(key, Buffer.from(bytes), {
          access: "private",
          contentType,
          token,
          addRandomSuffix: false,
        });
        return {
          storageKey: result.pathname || key,
          checksum: createHash("sha256").update(bytes).digest("hex"),
          byteSize: bytes.byteLength,
          contentType,
        };
      },
      async get() {
        throw new Error("Private blob get requires signed access credentials.");
      },
    };
  }
  return createLocalStorage();
}
