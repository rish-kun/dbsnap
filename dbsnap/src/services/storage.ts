import { Client, Query, Storage, ID, type Models } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";

function normalizeAppwriteEndpoint(apiUrl?: string): string {
  const base = (apiUrl ?? "https://sgp.cloud.appwrite.io/v1").trim().replace(/\/+$/, "");
  return base.endsWith("/v1") ? base : `${base}/v1`;
}

function createStorageClient(config: Record<string, string>): Storage {
  const client = new Client()
    .setEndpoint(normalizeAppwriteEndpoint(config.API_URL))
    .setProject(config.PROJECT_ID ?? "")
    .setKey(config.API_BACKUP_KEY ?? "");

  return new Storage(client);
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, idx);
  return `${value.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
}

export type DownloadProgress = {
  percent: number;
  downloadedBytes: number;
  totalBytes?: number;
  bytesPerSecond?: number;
  etaSeconds?: number;
};

export type BackupFile = Models.File;

export function sortBackupsNewestFirst<T extends Pick<BackupFile, "$createdAt">>(files: T[]): T[] {
  return [...files].sort((a, b) => new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime());
}

export function getLatestBackup<T extends Pick<BackupFile, "$createdAt">>(files: T[]): T {
  const latest = sortBackupsNewestFirst(files)[0];
  if (!latest) {
    throw new Error("No backups found in Appwrite.");
  }

  return latest;
}

export async function getFilesList(
  config: Record<string, string>,
  onLog?: (msg: string) => void
): Promise<BackupFile[]> {
  const projectId = config.PROJECT_ID;
  const bucketId = config.BUCKET_ID;
  const apiKey = config.API_BACKUP_KEY; // Server key

  if (!projectId || !bucketId || !apiKey) {
    if (onLog) onLog("Missing Appwrite configuration. Check your config.");
    throw new Error("Missing Appwrite config");
  }

  const storage = createStorageClient(config);
  const allFiles = [];
  const limit = 100;
  let lastFileId: string | null = null;
  let hasMore = true;

  if (onLog) onLog("Fetching list of backups from Appwrite...");

  while (hasMore) {
    const queries = [Query.orderDesc("$createdAt"), Query.limit(limit)];
    if (lastFileId) {
      queries.push(Query.cursorAfter(lastFileId));
    }

    const result = await storage.listFiles({
      bucketId: bucketId,
      queries: queries,
    });

    allFiles.push(...result.files);

    if (result.files.length < limit) {
      hasMore = false;
    } else {
      const lastFile = result.files[result.files.length - 1];
      if (!lastFile) {
        hasMore = false;
      } else {
        lastFileId = lastFile.$id;
      }
    }
  }

  if (onLog) onLog(`Found ${allFiles.length} backups.`);
  return sortBackupsNewestFirst(allFiles);
}

export async function uploadBackup(
  config: Record<string, string>,
  filePath: string,
  fileName: string,
  onLog?: (msg: string) => void
) {
  const projectId = config.PROJECT_ID;
  const bucketId = config.BUCKET_ID;
  const apiKey = config.API_BACKUP_KEY; // Server key

  if (!projectId || !bucketId || !apiKey) {
    if (onLog) onLog("Missing Appwrite configuration. Upload skipped.");
    throw new Error("Missing Appwrite config");
  }

  const storage = createStorageClient(config);

  const nodeFile = InputFile.fromPath(filePath, fileName);
  
  if (onLog) onLog(`🚀 Starting Appwrite upload for: ${fileName}`);
  
  const uploaded = await storage.createFile({
    bucketId,
    fileId: ID.unique(),
    file: nodeFile,
  });
  
  if (onLog) onLog(`✅ Backup uploaded to Appwrite: ${uploaded.$id}`);
  return uploaded;
}

export async function downloadBackup(
  config: Record<string, string>,
  fileId: string,
  destinationPath: string,
  onLog?: (msg: string) => void,
  onProgress?: (progress: DownloadProgress) => void
) {
  const apiUrl = normalizeAppwriteEndpoint(config.API_URL);
  const projectId = config.PROJECT_ID;
  const bucketId = config.BUCKET_ID;
  const apiKey = config.API_BACKUP_KEY; // Server key

  if (!projectId || !bucketId || !apiKey) {
    if (onLog) onLog("Missing Appwrite configuration. Download skipped.");
    throw new Error("Missing Appwrite config");
  }

  const encodedBucketId = encodeURIComponent(bucketId);
  const encodedFileId = encodeURIComponent(fileId);
  const downloadUrl = `${apiUrl}/storage/buckets/${encodedBucketId}/files/${encodedFileId}/download`;

  if (onLog) onLog(`Downloading file ${fileId} from Appwrite (REST download endpoint)...`);
  onProgress?.({ percent: 0, downloadedBytes: 0 });

  const abortController = new AbortController();
  const timeoutMs = 10 * 60 * 1000;
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(downloadUrl, {
      method: "GET",
      headers: {
        "X-Appwrite-Project": projectId,
        "X-Appwrite-Key": apiKey,
        "X-Appwrite-Response-Format": "1.8.0",
      },
      signal: abortController.signal,
    });
  } catch (error) {
    if (abortController.signal.aborted) {
      throw new Error(`Appwrite download timed out after ${Math.floor(timeoutMs / 1000)} seconds.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok || !response.body) {
    const bodyText = await response.text().catch(() => "");
    throw new Error(
      `Appwrite download failed (${response.status} ${response.statusText}): ${bodyText || "No response body"}`
    );
  }

  const contentLengthHeader = response.headers.get("content-length");
  const expectedBytes = contentLengthHeader ? Number(contentLengthHeader) : NaN;
  const totalBytes = Number.isFinite(expectedBytes) && expectedBytes > 0 ? expectedBytes : undefined;
  const destinationDir = path.dirname(destinationPath);
  const tempPath = `${destinationPath}.${crypto.randomUUID()}.part`;

  await mkdir(destinationDir, { recursive: true });
  await rm(tempPath, { force: true }).catch(() => {
    // ignore cleanup errors for a fresh temp path
  });

  const sink = Bun.file(tempPath).writer();
  sink.start();

  const startedAt = Date.now();
  let downloadedBytes = 0;
  let nextProgressAt = 10;
  let lastProgress = 0;
  let lastEmitAt = 0;

  try {
    const reader = response.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (value && value.byteLength > 0) {
        sink.write(value);
        downloadedBytes += value.byteLength;

        if (Number.isFinite(expectedBytes) && expectedBytes > 0) {
          const progress = Math.floor((downloadedBytes / expectedBytes) * 100);
          const clampedProgress = Math.min(99, Math.max(0, progress));

          const now = Date.now();
          const elapsedSeconds = Math.max((now - startedAt) / 1000, 0.001);
          const bytesPerSecond = downloadedBytes / elapsedSeconds;
          const etaSeconds = bytesPerSecond > 0 ? Math.max(0, (expectedBytes - downloadedBytes) / bytesPerSecond) : undefined;

          if (clampedProgress !== lastProgress || now - lastEmitAt >= 300) {
            onProgress?.({
              percent: clampedProgress,
              downloadedBytes,
              totalBytes,
              bytesPerSecond,
              etaSeconds,
            });
            lastProgress = clampedProgress;
            lastEmitAt = now;
          }

          if (progress >= nextProgressAt && onLog) {
            onLog(
              `Download progress: ${progress}% (${formatBytes(downloadedBytes)} / ${formatBytes(expectedBytes)})`
            );
            nextProgressAt += 10;
          }
        }
      }
    }

    await sink.end();
  } catch (error) {
    try {
      await sink.end(error instanceof Error ? error : undefined);
    } catch {
      // ignore sink close errors; original error will be thrown
    }
    try {
      await rm(tempPath, { force: true });
    } catch {
      // ignore cleanup errors
    }
    throw error;
  }

  if (Number.isFinite(expectedBytes) && expectedBytes > 0 && downloadedBytes !== expectedBytes) {
    try {
      await rm(tempPath, { force: true });
    } catch {
      // ignore cleanup errors
    }
    throw new Error(
      `Downloaded file size mismatch: got ${formatBytes(downloadedBytes)}, expected ${formatBytes(expectedBytes)}.`
    );
  }

  const downloadedStat = await stat(tempPath);
  if (downloadedStat.size !== downloadedBytes) {
    try {
      await rm(tempPath, { force: true });
    } catch {
      // ignore cleanup errors
    }
    throw new Error(
      `Downloaded file size mismatch on disk: got ${formatBytes(downloadedStat.size)}, expected ${formatBytes(downloadedBytes)}.`
    );
  }

  await rename(tempPath, destinationPath);

  if (onLog) {
    const suffix = Number.isFinite(expectedBytes) && expectedBytes > 0
      ? ` (expected ${formatBytes(expectedBytes)})`
      : "";
    onLog(`✅ File downloaded successfully to ${destinationPath} (${formatBytes(downloadedBytes)})${suffix}`);
  }

  const elapsedSeconds = Math.max((Date.now() - startedAt) / 1000, 0.001);
  const bytesPerSecond = downloadedBytes / elapsedSeconds;
  onProgress?.({
    percent: 100,
    downloadedBytes,
    totalBytes,
    bytesPerSecond,
    etaSeconds: 0,
  });

  return downloadedBytes;
}
