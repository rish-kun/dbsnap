import { uploadBackup } from "./upload.ts";
import takeBackup from "./backup.ts";
import { sendEmail } from "./email.ts";

try {
  const filePath = await takeBackup();
  const fileName = filePath.split("/").pop() ?? "backup.dump";
  const response = await uploadBackup(filePath, fileName);
  const fileUrl = `https://cloud.appwrite.io/v1/storage/buckets/${response.bucketId}/files/${response.$id}/view`;

  sendEmail("Database Snapshot and upload Successful", fileUrl);
  const colors = {
    reset: "\x1b[0m",
    blue: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    magenta: "\x1b[35m",
  };
  console.log(
    `${colors.green}✅ Backup taken and uploaded: ${response.$id}${colors.reset}`
  );
} catch (error) {
  await sendEmail(error instanceof Error ? error.message : String(error), "");
  throw error;
}
