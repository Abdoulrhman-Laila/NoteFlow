import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(fileName = ".env"): void {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) return;

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;

    const key = trimmed.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (process.env[key] !== undefined) continue;

    let value = trimmed.slice(separator + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));

    if (quoted && value.length >= 2) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function readPort(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return 3000;

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: "${value}". Expected an integer from 1 to 65535.`);
  }

  return port;
}

function readTrustProxy(value: string | undefined): false | number {
  if (value === undefined || value.trim() === "" || value === "0" || value.toLowerCase() === "false") {
    return false;
  }

  if (value.toLowerCase() === "true") {
    throw new Error('Invalid TRUST_PROXY value: "true". Set a hop count such as 1.');
  }

  const hops = Number(value);
  if (!Number.isInteger(hops) || hops < 1 || hops > 5) {
    throw new Error(`Invalid TRUST_PROXY value: "${value}". Expected false or an integer from 1 to 5.`);
  }

  return hops;
}

function readDatabaseUrl(value: string | undefined): string {
  if (value === undefined || value.trim() === "") {
    throw new Error("DATABASE_URL is required.");
  }

  return value.trim();
}

loadEnvFile();

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: readPort(process.env.PORT),
  trustProxy: readTrustProxy(process.env.TRUST_PROXY),
  databaseUrl: readDatabaseUrl(process.env.DATABASE_URL),
} as const;
