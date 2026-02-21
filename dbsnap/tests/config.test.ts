import { expect, test, describe } from "bun:test";
import { saveConfig, loadConfig } from "../src/services/config";
import { $ } from "bun";

describe("Config Service", () => {
  test("should save and load config correctly", async () => {
    // Write a temp value
    const mockData = { API_URL: "https://test.api" };
    await saveConfig(mockData);
    
    // Load config
    const config = await loadConfig();
    expect(config.API_URL).toBe("https://test.api");
  });
});
