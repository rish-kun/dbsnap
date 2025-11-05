import { uploadBackup } from "./upload.ts";
import takeBackup from "./backup.ts";
const filePath = await takeBackup();
const fileName = filePath.split("/").pop() ?? "backup.dump";
const response = await uploadBackup(filePath, fileName);
console.log("Upload Response:", response);
