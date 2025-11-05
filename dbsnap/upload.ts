// bun add node-appwrite
import { Client, Storage, ID } from "node-appwrite";
import { InputFile } from "node-appwrite/file";

export const uploadBackup = async (filePath: string, fileName: string) => {
  const apiUrl = process.env.API_URL ?? "https://sgp.cloud.appwrite.io/v1";
  const projectId = process.env.PROJECT_ID ?? "your_project_id_here";
  const bucketId = process.env.BUCKET_ID ?? "your_bucket_id_here";
  const apiKey = process.env.API_BACKUP_KEY ?? "your_api_key_here"; // Server key

  const client = new Client()
    .setEndpoint(apiUrl)
    .setProject(projectId)
    .setKey(apiKey);

  const storage = new Storage(client);

  // Read from disk using Bun and create an InputFile for Appwrite
  const nodeFile = InputFile.fromPath(filePath, fileName);
  const colors = {
    reset: "\x1b[0m",
    blue: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    magenta: "\x1b[35m",
  };
  console.log(
    `${colors.blue}🚀 Starting upload for db backup: ${fileName}${colors.reset}`
  );
  // Upload (SDK handles chunking for large files)
  const uploaded = await storage.createFile(bucketId, ID.unique(), nodeFile);
  console.log(
    `${colors.green}✅ Backup uploaded: ${uploaded.$id}${colors.reset}`
  );
  return uploaded;
};
// uploadBackup("../merch4.jpeg", "merch4.jpeg");
