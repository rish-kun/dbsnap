import path from "path";

// For robust execution, use the directory where this script is located (src/services) and go up one level to dbsnap root.
const ENV_PATH = path.join(import.meta.dir, "../../.env");

export async function loadConfig(): Promise<Record<string, string>> {
  const envFile = Bun.file(ENV_PATH);
  if (await envFile.exists()) {
    const text = await envFile.text();
    const env: Record<string, string> = {};
    text.split("\n").forEach((line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        env[match[1]] = match[2].trim();
      }
    });
    return env;
  }
  return {};
}

export async function saveConfig(newConfig: Record<string, string>) {
  const current = await loadConfig();
  const merged = { ...current, ...newConfig };
  
  const content = Object.entries(merged)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  
  await Bun.write(ENV_PATH, content);
  return merged;
}
