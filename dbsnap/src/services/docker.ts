import { $ } from "bun";

export async function getDockerContainers(): Promise<string[]> {
  try {
    const dockerPs = await $`docker ps --format "{{.Names}}"`.text();
    return dockerPs.trim().split("\n").filter(Boolean);
  } catch (err) {
    return [];
  }
}
