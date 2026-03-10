import {
  CREDENTIALS_PATH
} from "./chunk-SZO4OB6U.js";

// src/bin.ts
import { existsSync, readFileSync } from "fs";
import { join } from "path";
function loadEnvIntoProcess(filePath) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
loadEnvIntoProcess(join(process.cwd(), ".env"));
loadEnvIntoProcess(CREDENTIALS_PATH);
var { default: cli } = await import("./cli.js");
cli.serve();
