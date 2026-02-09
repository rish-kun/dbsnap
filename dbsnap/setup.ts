import { input, select, password as askPassword, confirm } from "@inquirer/prompts";
import { saveConfig } from "./config.ts";
import { $ } from "bun";
import path from "path";

export async function runSetup() {
  console.log("\n🚀 DBSnap Setup Wizard\n");

  // 1. Appwrite Config
  console.log("--- Appwrite Configuration ---");
  const apiUrl = await input({ message: "Appwrite API Endpoint:", default: "https://cloud.appwrite.io/v1" });
  const projectId = await input({ message: "Project ID:" });
  const bucketId = await input({ message: "Bucket ID:" });
  const apiKey = await askPassword({ message: "Appwrite API Key:" });

  // 2. Email Config
  console.log("\n--- Email Configuration (SendGrid) ---");
  const sendgridKey = await askPassword({ message: "SendGrid API Key:" });
  const emailFrom = await input({ message: "From Email:" });
  const emailTo = await input({ message: "To Email:" });

  // 3. Docker Config
  console.log("\n--- Docker Configuration ---");
  let selectedContainer = "";
  try {
    const dockerPs = await $`docker ps --format "{{.Names}}"`.text();
    const containers = dockerPs.trim().split("\n").filter(Boolean);
    
    if (containers.length === 0) {
      console.log("⚠️ No running Docker containers found.");
      const manual = await confirm({ message: "Do you want to enter the container name manually?", default: true });
      if (manual) {
        selectedContainer = await input({ message: "Container Name:" });
      } else {
        process.exit(1);
      }
    } else {
      selectedContainer = await select({
        message: "Select the database container to backup:",
        choices: containers.map(c => ({ name: c, value: c })),
      });
    }
  } catch (err) {
    console.log("⚠️ Docker command failed. Ensure Docker is running.");
    selectedContainer = await input({ message: "Container Name (Manual Entry):" });
  }

  // 4. System Config
  console.log("\n--- System Configuration ---");
  const needsSudo = await confirm({ message: "Do you need sudo to run docker commands?", default: false });
  let scriptPassword = "";
  if (needsSudo) {
    scriptPassword = await askPassword({ message: "Sudo Password (stored in .env):" });
  }

  // Save Config
  await saveConfig({
    API_URL: apiUrl,
    PROJECT_ID: projectId,
    BUCKET_ID: bucketId,
    API_BACKUP_KEY: apiKey,
    SENDGRID_API_KEY: sendgridKey,
    EMAIL_FROM: emailFrom,
    EMAIL_TO: emailTo,
    DOCKER_CONTAINER: selectedContainer,
    SCRIPT_PASSWORD: scriptPassword,
  });

  console.log("✅ Configuration saved to .env");

  // 5. Cron Setup
  console.log("\n--- Cron Job Setup ---");
  const setupCron = await confirm({ message: "Do you want to set up a cron job now?", default: true });
  
  if (setupCron) {
    const interval = await select({
      message: "Select backup interval:",
      choices: [
        { name: "Every Minute (Test)", value: "* * * * *" },
        { name: "Every Hour", value: "0 * * * *" },
        { name: "Every Day at Midnight", value: "0 0 * * *" },
        { name: "Custom", value: "custom" },
      ],
    });

    let cronExpression = interval;
    if (interval === "custom") {
      cronExpression = await input({ message: "Enter custom cron expression (e.g. '0 0 * * *'):" });
    }

    // Determine paths
    // We use absolute paths for cron to work reliably
    const scriptDir = import.meta.dir;
    const scriptPath = path.join(scriptDir, "index.ts");
    const bunPath = process.execPath; // Path to bun executable
    
    // Log file in the same directory (or parent)
    const logPath = path.join(scriptDir, "../dbsnap.log");
    
    // We cd to the dbsnap directory so relative paths (like backups folder) work if they are relative to CWD
    // Wait, in `backup.ts` we do `mkdir -p ./backups`. This implies CWD matters.
    // So we should `cd` to the project root or the script dir.
    // The previous structure had `dbsnap/index.ts` inside `dbsnap` folder.
    // Let's assume the "project root" is the parent of `dbsnap` folder.
    
    const projectRoot = path.dirname(scriptDir);
    
    const command = `cd ${projectRoot} && ${bunPath} ${scriptPath} --run >> ${logPath} 2>&1`;
    const cronLine = `${cronExpression} ${command}`;

    try {
      const currentCrontab = await $`crontab -l`.quiet().text().catch(() => "");
      
      // Filter out existing dbsnap jobs to avoid duplicates (loose matching)
      const newCrontabLines = currentCrontab
        .split("\n")
        .filter(line => !line.includes("dbsnap/index.ts") && line.trim() !== "");
      
      newCrontabLines.push(cronLine);
      const finalCrontab = newCrontabLines.join("\n") + "\n";
      
      // Write back
      const proc = Bun.spawn(["crontab", "-"], {
        stdin: new TextEncoder().encode(finalCrontab),
      });
      await proc.exited;
      
      console.log("✅ Cron job updated!");
      console.log(`   Job: ${cronLine}`);
    } catch (err) {
      console.error("❌ Failed to update crontab:", err);
      console.log("You can add it manually:");
      console.log(cronLine);
    }
  }

  console.log("\n🎉 Setup Complete! You can run 'bun dbsnap/index.ts --run' to test immediately.");
}
