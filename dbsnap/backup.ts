import { $ } from "bun";

export default async function takeBackup(dbname: String = "postgres") {
  const date = new Date();
  const timestamp = date.toISOString().replace(/[:.]/g, "-");
  const backupFileName = `${dbname}-backup-${timestamp}.sql`;
  const container = "Oasis_2025-postgres";
  const tmpPath = "/tmp/backup.dump"; // inside container
  // or generate a timestamped name
  // Command to take a database backup (example for PostgreSQL)
  const password = process.env.SCRIPT_PASSWORD || "your_password_here";
  await $`mkdir -p ./backups`;
  console.log(`Starting backup for database: ${dbname}`);
  await $`printf '%s\n' ${password} | sudo -S -p '' docker exec ${container} pg_dump -U postgres -Fc -f ${tmpPath} postgres`;
  console.log(`Backup created inside container at: ${tmpPath}`);
  await $`printf '%s\n' ${password} | sudo -S -p '' docker cp ${container}:${tmpPath} ./backups/${backupFileName}`;
  console.log(`Backup taken: ./backups/${backupFileName}`);
  await $`printf '%s\n' ${password} | sudo -S -p '' docker exec ${container} rm ${tmpPath}`;
  console.log(`Temporary backup file removed: ${tmpPath}`);
}

takeBackup();
