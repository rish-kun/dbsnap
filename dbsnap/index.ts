import { uploadBackup } from "./upload.ts";
import takeBackup from "./backup.ts";
const filePath = await takeBackup();
const fileName = filePath.split("/").pop() ?? "backup.dump";
const response = await uploadBackup(filePath, fileName);

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
