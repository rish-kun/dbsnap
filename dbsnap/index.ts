import { uploadBackup } from "./upload.ts";
import takeBackup from "./backup.ts";
import { sendEmail } from "./email.ts";
import { runSetup } from "./setup.ts";
import { loadConfig } from "./config.ts";
import { select } from "@inquirer/prompts";

async function main() {
  const args = process.argv.slice(2);
  const config = await loadConfig();
  
  // Populate process.env for compatibility with legacy code and libraries
  Object.assign(process.env, config);

  // If no args or --setup
  if (args.includes("--setup")) {
    await runSetup();
    return;
  }

  // If config is missing critical keys, force setup
  if (!config.API_URL || !config.DOCKER_CONTAINER) {
    if (!args.includes("--setup")) {
      console.log("⚠️ No configuration found. Starting setup...");
    }
    await runSetup();
    return;
  }

  // Run mode
  if (args.includes("--run")) {
    await runBackupRoutine(config);
    return;
  }

  // Interactive Menu (Default)
  const action = await select({
    message: "What would you like to do?",
    choices: [
      { name: "Run Backup Now", value: "run" },
      { name: "Configure / Setup", value: "setup" },
      { name: "Exit", value: "exit" },
    ],
  });

  if (action === "run") {
    await runBackupRoutine(config);
  } else if (action === "setup") {
    await runSetup();
  }
}

async function runBackupRoutine(config: Record<string, string>) {
  try {
    const container = config.DOCKER_CONTAINER || "Oasis_2025-postgres"; // Fallback if missing
    console.log(`Starting backup for container: ${container}`);

    const filePath = await takeBackup("postgres", container);
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
    console.error("Backup Routine Error:", error);
    await sendEmail(error instanceof Error ? error.message : String(error), "");
    process.exit(1);
  }
}

main();
