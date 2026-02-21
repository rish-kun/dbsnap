import { runSudo } from "../utils/exec";
import { $ } from "bun";
import path from "path";

export async function takeBackup(
  config: Record<string, string>,
  dbname: string = "postgres",
  onLog?: (msg: string) => void
) {
  const container = config.DOCKER_CONTAINER || "Oasis_2025-postgres";
  const password = config.SCRIPT_PASSWORD;
  
  const date = new Date();
  const timestamp = date.toISOString().replace(/[:.]/g, "-");
  const backupFileName = `${dbname}-backup-${timestamp.replace(/T/, "_").replace(/Z$/, "")}.sql`;
  const tmpPath = "backup.dump";
  
  const rootDir = path.resolve(import.meta.dir, "../../");
  const backupsDir = path.join(rootDir, "backups");
  const backupFilePath = path.join(backupsDir, backupFileName);
  
  await $`mkdir -p ${backupsDir}`;

  if (onLog) onLog(`🚀 Starting backup for database: ${dbname} in container ${container}`);

  const dumpCmd = [
    "docker",
    "exec",
    container,
    "pg_dump",
    "-U",
    "postgres",
    "-Fc",
    "-f",
    tmpPath,
    "postgres",
  ];

  await runSudo(password, dumpCmd, onLog);

  if (onLog) onLog(`⚙️  Backup process finished inside the container...`);

  // Copy backup file out of the container
  await runSudo(password, [
    "docker",
    "cp",
    `${container}:${tmpPath}`,
    backupFilePath,
  ], onLog);
  
  if (onLog) onLog(`✅ Backup taken: ${backupFilePath}`);

  try {
    // Remove temp file inside the container
    await runSudo(password, ["docker", "exec", container, "rm", tmpPath], onLog);
    if (onLog) onLog(`🧹 Temporary backup file removed: ${tmpPath}`);
  } catch (err) {
    if (onLog) onLog(`⚠️  Could not remove temporary backup file: ${tmpPath}`);
  }
  
  return backupFilePath;
}
