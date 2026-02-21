import { Client, Query, Storage, ID } from "node-appwrite";
import { InputFile } from "node-appwrite/file";

export async function getFilesList(config: Record<string, string>, onLog?: (msg: string) => void) {
  const apiUrl = config.API_URL ?? "https://sgp.cloud.appwrite.io/v1";
  const projectId = config.PROJECT_ID;
  const bucketId = config.BUCKET_ID;
  const apiKey = config.API_BACKUP_KEY; // Server key

  if (!projectId || !bucketId || !apiKey) {
    if (onLog) onLog("Missing Appwrite configuration. Check your config.");
    throw new Error("Missing Appwrite config");
  }

  const client = new Client()
    .setEndpoint(apiUrl)
    .setProject(projectId)
    .setKey(apiKey);

  const storage = new Storage(client);
  const allFiles = [];
  const limit = 100;
  let lastFileId: string | null = null;
  let hasMore = true;

  if (onLog) onLog("Fetching list of backups from Appwrite...");

  while (hasMore) {
    const queries = [Query.limit(limit)];
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
      lastFileId = result.files[result.files.length - 1].$id;
    }
  }

  if (onLog) onLog(`Found ${allFiles.length} backups.`);
  return allFiles;
}

export async function uploadBackup(
  config: Record<string, string>,
  filePath: string,
  fileName: string,
  onLog?: (msg: string) => void
) {
  const apiUrl = config.API_URL ?? "https://sgp.cloud.appwrite.io/v1";
  const projectId = config.PROJECT_ID;
  const bucketId = config.BUCKET_ID;
  const apiKey = config.API_BACKUP_KEY; // Server key

  if (!projectId || !bucketId || !apiKey) {
    if (onLog) onLog("Missing Appwrite configuration. Upload skipped.");
    throw new Error("Missing Appwrite config");
  }

  const client = new Client()
    .setEndpoint(apiUrl)
    .setProject(projectId)
    .setKey(apiKey);

  const storage = new Storage(client);

  const nodeFile = InputFile.fromPath(filePath, fileName);
  
  if (onLog) onLog(`🚀 Starting Appwrite upload for: ${fileName}`);
  
  const uploaded = await storage.createFile(bucketId, ID.unique(), nodeFile);
  
  if (onLog) onLog(`✅ Backup uploaded to Appwrite: ${uploaded.$id}`);
  return uploaded;
}

export async function downloadBackup(
  config: Record<string, string>,
  fileId: string,
  destinationPath: string,
  onLog?: (msg: string) => void
) {
  const apiUrl = config.API_URL ?? "https://sgp.cloud.appwrite.io/v1";
  const projectId = config.PROJECT_ID;
  const bucketId = config.BUCKET_ID;
  const apiKey = config.API_BACKUP_KEY; // Server key

  if (!projectId || !bucketId || !apiKey) {
    throw new Error("Missing Appwrite config");
  }

  const client = new Client()
    .setEndpoint(apiUrl)
    .setProject(projectId)
    .setKey(apiKey);

  const storage = new Storage(client);

  if (onLog) onLog(`Downloading file ${fileId} from Appwrite...`);

  const result = await storage.getFileDownload({
    bucketId: bucketId,
    fileId: fileId,
  });

  const savedFile = await Bun.write(destinationPath, result);
  
  if (onLog) onLog(`✅ File downloaded successfully to ${destinationPath}`);
  return savedFile;
}
