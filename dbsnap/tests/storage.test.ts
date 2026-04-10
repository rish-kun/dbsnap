import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { downloadBackup, getLatestBackup, sortBackupsNewestFirst, type BackupFile } from "../src/services/storage";

const baseConfig = {
  API_URL: "https://example.test/v1",
  PROJECT_ID: "project-id",
  BUCKET_ID: "bucket-id",
  API_BACKUP_KEY: "backup-key",
};

function createStreamingResponse(chunks: number[][], headers?: Record<string, string>) {
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(Uint8Array.from(chunk));
        }
        controller.close();
      },
    }),
    {
      status: 200,
      headers,
    }
  );
}

describe("storage helpers", () => {
  test("sortBackupsNewestFirst returns newest items first", () => {
    const files = [
      { $id: "one", $createdAt: "2026-03-28T08:00:00.000Z" },
      { $id: "three", $createdAt: "2026-03-30T08:00:00.000Z" },
      { $id: "two", $createdAt: "2026-03-29T08:00:00.000Z" },
    ] satisfies Array<Pick<BackupFile, "$id" | "$createdAt">>;

    expect(sortBackupsNewestFirst(files).map((file) => file.$id)).toEqual(["three", "two", "one"]);
  });

  test("getLatestBackup returns the newest backup", () => {
    const latest = getLatestBackup([
      { $id: "older", $createdAt: "2026-03-28T08:00:00.000Z" },
      { $id: "newer", $createdAt: "2026-03-30T08:00:00.000Z" },
    ] satisfies Array<Pick<BackupFile, "$id" | "$createdAt">>);

    expect(latest.$id).toBe("newer");
  });

  test("getLatestBackup throws for an empty list", () => {
    expect(() => getLatestBackup([])).toThrow("No backups found in Appwrite.");
  });
});

describe("downloadBackup", () => {
  let tempDir: string;
  let originalFetch: typeof fetch;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "dbsnap-storage-test-"));
    originalFetch = globalThis.fetch;
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await rm(tempDir, { recursive: true, force: true });
  });

  test("replaces an older larger file without leaving stale bytes", async () => {
    const destinationPath = path.join(tempDir, "backup.dump");
    await Bun.write(destinationPath, Uint8Array.from([65, 65, 65, 65, 65, 65]));

    globalThis.fetch = mock(() =>
      Promise.resolve(
        createStreamingResponse([[1, 2], [3]], {
          "content-length": "3",
        })
      )
    ) as typeof fetch;

    await downloadBackup(baseConfig, "file-id", destinationPath);

    const bytes = new Uint8Array(await Bun.file(destinationPath).arrayBuffer());
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
    expect(bytes.byteLength).toBe(3);
  });

  test("cleans up staged files after a stream failure", async () => {
    const destinationPath = path.join(tempDir, "backup.dump");

    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(Uint8Array.from([1, 2, 3]));
              controller.error(new Error("stream exploded"));
            },
          }),
          {
            status: 200,
            headers: {
              "content-length": "6",
            },
          }
        )
      )
    ) as typeof fetch;

    await expect(downloadBackup(baseConfig, "file-id", destinationPath)).rejects.toThrow("stream exploded");

    const files = await readdir(tempDir);
    expect(files).toEqual([]);
  });

  test("creates missing destination directories before downloading", async () => {
    const nestedDir = path.join(tempDir, "nested");
    const destinationPath = path.join(nestedDir, "backup.dump");
    await mkdir(tempDir, { recursive: true });

    globalThis.fetch = mock(() =>
      Promise.resolve(
        createStreamingResponse([[9, 8, 7]], {
          "content-length": "3",
        })
      )
    ) as typeof fetch;

    await downloadBackup(baseConfig, "file-id", destinationPath);

    expect(await Bun.file(destinationPath).exists()).toBeTrue();
    const bytes = new Uint8Array(await Bun.file(destinationPath).arrayBuffer());
    expect(Array.from(bytes)).toEqual([9, 8, 7]);
  });
});
