import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadConfig, saveConfig } from "./config";

const CONFIG_FIELDS = [
    { key: "API_URL", label: "Appwrite URL" },
    { key: "PROJECT_ID", label: "Project ID" },
    { key: "BUCKET_ID", label: "Bucket ID" },
    { key: "API_BACKUP_KEY", label: "API Key", secret: true },
    { key: "SENDGRID_API_KEY", label: "SendGrid Key", secret: true },
    { key: "EMAIL_FROM", label: "Email From" },
    { key: "EMAIL_TO", label: "Email To" },
    { key: "DOCKER_CONTAINER", label: "Container" },
    { key: "DB_NAME", label: "Database" },
    { key: "SCRIPT_PASSWORD", label: "Sudo Password", secret: true },
];

function maskValue(value: string | undefined, secret: boolean): string {
    if (!value) return "(not set)";
    return secret ? "••••••••" : value;
}

function displayConfig(config: Record<string, string>) {
    console.log("\n\x1b[1m\x1b[33m📸 DBSnap CLI — Current Configuration\x1b[0m\n");
    CONFIG_FIELDS.forEach(({ key, label, secret }, i) => {
        const num = `${i + 1}`.padStart(2, " ");
        const displayLabel = label.padEnd(16, " ");
        const value = maskValue(config[key], !!secret);
        console.log(`  \x1b[36m${num}.\x1b[0m ${displayLabel}: \x1b[37m${value}\x1b[0m`);
    });
    console.log();
}

export async function runConfigEditor() {
    const rl = readline.createInterface({ input, output });
    let config = await loadConfig();
    let dirty = false;

    displayConfig(config);

    while (true) {
        console.log("  \x1b[32m[e]\x1b[0m Edit a field");
        console.log("  \x1b[31m[q]\x1b[0m Save & Quit\n");

        const choice = (await rl.question("\x1b[33m> \x1b[0m")).trim().toLowerCase();

        if (choice === "q") {
            if (dirty) {
                console.log("\nSaving configuration...");
                try {
                    await saveConfig(config);
                    console.log("\x1b[32m✅ Configuration saved!\x1b[0m");
                } catch (e: any) {
                    console.error(`\x1b[31m❌ Failed to save: ${e.message}\x1b[0m`);
                }
            } else {
                console.log("No changes made.");
            }
            rl.close();
            process.exit(0);
        }

        if (choice === "e") {
            const numStr = (await rl.question(`\x1b[33mEnter field number (1-${CONFIG_FIELDS.length}): \x1b[0m`)).trim();
            const num = parseInt(numStr, 10);

            if (isNaN(num) || num < 1 || num > CONFIG_FIELDS.length) {
                console.log("\x1b[31mInvalid field number. Try again.\x1b[0m\n");
                continue;
            }

            const field = CONFIG_FIELDS[num - 1];
            if (!field) {
                console.log("\x1b[31mInvalid field number. Try again.\x1b[0m\n");
                continue;
            }

            const currentValue = config[field.key];
            if (currentValue) {
                console.log(`  Current value: \x1b[90m${maskValue(currentValue, !!field.secret)}\x1b[0m`);
            }

            const newValue = (await rl.question(`  Enter new value for \x1b[36m${field.label}\x1b[0m: `)).trim();

            if (newValue) {
                config[field.key] = newValue;
                dirty = true;
                console.log(`\x1b[32m  ✅ Updated ${field.label}\x1b[0m\n`);
            } else {
                console.log("\x1b[90m  Skipped (empty input).\x1b[0m\n");
            }

            displayConfig(config);
            continue;
        }

        console.log("\x1b[31mInvalid option. Enter 'e' to edit or 'q' to quit.\x1b[0m\n");
    }
}
