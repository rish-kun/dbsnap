import { $ } from "bun";
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

export default async function takeBackup(dbname: String = "postgres") {
  const date = new Date();
  const timestamp = date.toISOString().replace(/[:.]/g, "-");
  const backupFileName = `${dbname}-backup-${timestamp}.sql`;
  const container = "Oasis_2025-postgres";
  const tmpPath = "backup.dump"; // inside container
  // or generate a timestamped name
  // Command to take a database backup (example for PostgreSQL)
  const password = process.env.SCRIPT_PASSWORD || "your_password_here";
  await $`mkdir -p ./backups`;
  await console.log(`Starting backup for database: ${dbname}`);
  const proc = await Bun.spawn({
    cmd: [
      "sudo",
      "-S",
      "-p",
      "",
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
    ],
    stdin: new TextEncoder().encode(password + "\n"),
    stdout: "pipe",
    stderr: "pipe",
  });
  await console.log("Backup process finished inside the container...");

  // Copy backup file out of the container
  await runSudo(password, [
    "docker",
    "cp",
    `${container}:${tmpPath}`,
    `./backups/${backupFileName}`,
  ]);
  await console.log(`Backup taken: ./backups/${backupFileName}`);

  // Remove temp file inside the container
  await runSudo(password, ["docker", "exec", container, "rm", tmpPath]);
  await console.log(`Temporary backup file removed: ${tmpPath}`);
}

takeBackup();
