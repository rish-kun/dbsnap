import { $ } from "bun";

export async function getDockerContainers(): Promise<string[]> {
  try {
    const dockerPs = await $`docker ps --format "{{.Names}}"`.text();
    return dockerPs.trim().split("\n").filter(Boolean);
  } catch (err) {
    return [];
  }
}

export async function getDatabases(container: string, dbUser = "postgres"): Promise<string[]> {
  try {
    const result = await $`docker exec ${container} psql -U ${dbUser} -t -c "SELECT datname FROM pg_database WHERE datistemplate = false AND datname NOT IN ('postgres', 'template0', 'template1', 'rdsadmin') ORDER BY datname;"`.text();
    return result.trim().split("\n").map(db => db.trim()).filter(Boolean);
  } catch (err) {
    console.error("Failed to fetch databases:", err);
    return [];
  }
}
