import { Client, Query, Storage } from "node-appwrite";

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

  // Fetch all files using cursor-based pagination
  const allFiles = [];
  const limit = 100; // Max items per request
  let lastFileId: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const queries = [Query.limit(limit)];

    // Add cursor for pagination (skip first request)
    if (lastFileId) {
      queries.push(Query.cursorAfter(lastFileId));
    }

    const result = await storage.listFiles({
      bucketId: bucketId,
      queries: queries,
    });

    allFiles.push(...result.files);

    // Check if we got fewer results than the limit (reached the end)
    if (result.files.length < limit) {
      hasMore = false;
    } else {
      // Use the last file's ID as cursor for next request
      lastFileId = result.files[result.files.length - 1].$id;
    }
  }

  //   for (const file of allFiles) {
  //     console.log(
  //       `File ID: ${file.$id}, Name: ${file.name}, Created At: ${new Date(
  //         file.$createdAt
  //       ).toISOString()}`
  //     );
  //   }
  return allFiles;
}
