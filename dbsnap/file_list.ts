import { Client, Storage } from "node-appwrite";

export async function getFilesList() {
  const apiUrl = process.env.API_URL ?? "https://sgp.cloud.appwrite.io/v1";
  const projectId = process.env.PROJECT_ID ?? "your_project_id_here";
  const bucketId = process.env.BUCKET_ID ?? "your_bucket_id_here";
  const apiKey = process.env.API_BACKUP_KEY ?? "your_api_key_here"; // Server key

  const client = new Client()
    .setEndpoint(apiUrl) // Your API Endpoint
    .setProject(projectId) // Your project ID
    .setKey(apiKey); // Your secret API key

  const storage = new Storage(client);

  const result = await storage.listFiles({
    bucketId: bucketId,
  });

  //   for (const file of result.files) {
  //     console.log(
  //       `File ID: ${file.$id}, Name: ${file.name}, Created At: ${new Date(
  //         file.$createdAt
  //       ).toISOString()}`
  //     );
  //   }
  return result.files;
}
