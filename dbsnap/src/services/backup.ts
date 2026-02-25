import { runSudo } from "../utils/exec";
import { $ } from "bun";
import path from "path";

export async function takeBackup(
  config: Record<string, string>,
  dbname: string = "postgres",
  onLog?: (msg: string) => void
) {
  const container = config.DOCKER_CONTAINER || config.DB_HOST === "db" ? "postgres" : "Oasis_2025-postgres";
  const password = config.SCRIPT_PASSWORD;
  const dbHost = config.DB_HOST || "localhost";
  const dbPort = config.DB_PORT || "5432";
  const isRemote = dbHost !== "localhost" && dbHost !== "127.0.0.1";
  
  const date = new Date();
  const timestamp = date.toISOString().replace(/[:.]/g, "-");
  const backupFileName = `${dbname}-backup-${timestamp.replace(/T/, "_").replace(/Z$/, "")}.sql`;
  const tmpPath = "backup.dump";
  
  const rootDir = path.resolve(import.meta.dir, "../../");
  const backupsDir = path.join(rootDir, "backups");
  const backupFilePath = path.join(backupsDir, backupFileName);
  
  await $`mkdir -p ${backupsDir}`;

  if (onLog) onLog(`🚀 Starting backup for database: ${dbname}`);
  if (onLog) onLog(`📦 Target: ${isRemote ? `${dbHost}:${dbPort}` : `container ${container}`}`);

  if (isRemote) {
    if (onLog) onLog(`🌐 Using remote database connection: ${dbHost}:${dbPort}`);
    const pgDumpCmd = [
      "pg_dump",
      "-h", dbHost,
      "-p", dbPort,
      "-U", "postgres",
      "-Fc",
      "-f", backupFilePath,
      dbname,
    ];
    const env = { ...process.env, PGPASSWORD: password || "postgres" };
    const proc = Bun.spawn(pgDumpCmd, { env });
    const output = await new Response(proc.stdout).text();
    const errOutput = await new Response(proc.stderr).text();
    
    if (proc.exitCode !== 0) {
      throw new Error(`pg_dump failed: ${errOutput || output}`);
    }
    
    if (onLog) onLog(`✅ Backup taken: ${backupFilePath}`);
    return backupFilePath;
  }

  if (onLog) onLog(`🐳 Using docker container: ${container}`);

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

  await runSudo(password, [
    "docker",
    "cp",
    `${container}:${tmpPath}`,
    backupFilePath,
  ], onLog);
  
  if (onLog) onLog(`✅ Backup taken: ${backupFilePath}`);

  try {
    await runSudo(password, ["docker", "exec", container, "rm", tmpPath], onLog);
    if (onLog) onLog(`🧹 Temporary backup file removed: ${tmpPath}`);
  } catch (err) {
    if (onLog) onLog(`⚠️  Could not remove temporary backup file: ${tmpPath}`);
  }
  
  return backupFilePath;
}
