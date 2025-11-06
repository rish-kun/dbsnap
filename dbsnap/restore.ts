import { select } from "@inquirer/prompts";
import { Client, Storage } from "node-appwrite";
import { getFilesList } from "./file_list";
const colors = {
  reset: "\x1b[0m",
  blue: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
};
const enc = new TextEncoder();
async function runSudo(password: string, args: string[]) {
  const proc = Bun.spawn(["sudo", "-S", "-p", "", ...args], {
    stdin: enc.encode(password + "\n"),
    stdout: "pipe",
    stderr: "pipe",
  });

  const [code, out, err] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  if (code !== 0) {
    throw new Error(`Command failed (${code}): ${args.join(" ")}\n${err}`);
  }

  return { out, err, code };
}
async function selectFileToRestore() {
  const files = await getFilesList();
  const sortedFiles = files.sort((a, b) => {
    return new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime();
  });
  const choices = sortedFiles.map((file) => ({
    name: `${file.name} (${new Date(file.$createdAt).toLocaleString()})`,
    value: file.$id,
    description: `File ID: ${file.$id}, Size: ${(
      file.sizeOriginal /
      1024 /
      1024
    ).toFixed(2)} MB`,
  }));

  const selectedFileId = await select({
    message: "Select backup file to restore:",
    choices: choices,
    loop: false,
  });

  return selectedFileId;
}

export default async function restoreSelected(selectedId: string) {
  console.log("Restoring file with ID:", selectedId);
  const apiUrl = process.env.API_URL ?? "https://sgp.cloud.appwrite.io/v1";
  const projectId = process.env.PROJECT_ID ?? "your_project_id_here";
  const bucketId = process.env.BUCKET_ID ?? "your_bucket_id_here";
  const apiKey = process.env.API_BACKUP_KEY ?? "your_api_key_here"; // Server key
  const container = "Oasis_2025-postgres";
  const password = process.env.SCRIPT_PASSWORD || "your_password_here";

  const client = new Client()
    .setEndpoint(apiUrl) // Your API Endpoint
    .setProject(projectId) // Your project ID
    .setKey(apiKey); // Your secret API key

  const storage = new Storage(client);

  const result = await storage.getFileDownload({
    bucketId: bucketId,
    fileId: selectedId,
  });
  //   console.log(result);
  const currentPath = "./backups/backup.dump";
  const savedFile = await Bun.write(currentPath, result);
  await runSudo(password, [
    "docker",
    "cp",
    `${currentPath}`,
    `${container}:$/backup.dump`,
  ]);
  console.log(`${colors.green}✅ File restored successfully:${colors.reset}`);

  try {
    await runSudo(password, [
      "docker",
      "exec",
      "Oasis_2025-postgres",
      "pg_restore",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "--clean",
      "--if-exists",
      "-j",
      "4",
      "/backup.dump",
    ]);
    console.log(
      `${colors.green}✅ Database restored successfully.${colors.reset}`
    );
  } catch (error) {
    console.log(
      `${colors.red}❌ Database restore failed:${colors.reset}`,
      error
    );
  }
}

const file = await selectFileToRestore();
const res = restoreSelected(file);
// console.log(res);
