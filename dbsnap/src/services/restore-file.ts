import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function createRestoreDownloadPath(fileId: string): Promise<string> {
  const restoreDir = path.join(tmpdir(), "dbsnap");
  await mkdir(restoreDir, { recursive: true });

  const safeFileId = sanitizeSegment(fileId);
  return path.join(restoreDir, `${safeFileId}-${Date.now()}.dump`);
}

export async function cleanupRestoreDownloadPath(filePath: string): Promise<void> {
  await rm(filePath, { force: true }).catch(() => {
    // ignore cleanup errors
  });
  await rm(`${filePath}.part`, { force: true }).catch(() => {
    // ignore cleanup errors
  });
}
