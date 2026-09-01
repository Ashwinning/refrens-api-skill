import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { DEFAULT_CREDENTIALS_FILE } from "./constants.js";

export function resolveCredentialsPath(inputPath, cwd = process.cwd()) {
  return path.resolve(cwd, inputPath ?? DEFAULT_CREDENTIALS_FILE);
}

export function credentialPermissionsSafe(filePath) {
  if (process.platform !== "win32") {
    return null;
  }

  const result = spawnSync("icacls", [filePath], {
    encoding: "utf8",
    windowsHide: true
  });

  if (result.error || result.status !== 0) {
    return null;
  }

  const riskyPrincipals = [
    "authenticated users",
    "everyone",
    "builtin\\users"
  ];
  const riskyRights = /\([^)]*[mfw][^)]*\)/i;

  return !result.stdout
    .toLowerCase()
    .split(/\r?\n/)
    .some((line) =>
      riskyPrincipals.some(
        (principal) => line.includes(principal) && riskyRights.test(line)
      )
    );
}

export function parseCredentialsText(text) {
  const rawValues = new Map();
  let currentKey = null;

  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();
    const lineNumber = index + 1;

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const existing = currentKey ? rawValues.get(currentKey) : null;
    const inMultilinePrivateKey =
      currentKey === "private_key" &&
      typeof existing === "string" &&
      /^[\"']/.test(existing) &&
      !existing.endsWith(existing[0]);

    if (inMultilinePrivateKey) {
      rawValues.set(currentKey, `${existing}\n${rawLine.replace(/\s+$/, "")}`);
      continue;
    }

    const match = trimmed.match(
      /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/
    );
    if (!match) {
      if (currentKey !== "private_key") {
        throw new Error(`Malformed credentials line ${lineNumber}`);
      }
      rawValues.set(
        currentKey,
        `${rawValues.get(currentKey)}\n${rawLine.replace(/\s+$/, "")}`
      );
      continue;
    }

    const key = match[1].toLowerCase();
    const value = match[2].trim();

    if (rawValues.has(key)) {
      throw new Error(`Duplicate credential name on line ${lineNumber}: ${key}`);
    }

    currentKey = key;
    rawValues.set(key, value);
  }

  const values = {};
  for (const [key, rawValue] of rawValues.entries()) {
    let value = rawValue;

    if (
      value.length >= 2 &&
      value.startsWith("\"") &&
      value.endsWith("\"")
    ) {
      if (value.includes("\n")) {
        value = value.slice(1, -1);
      } else {
        try {
          value = JSON.parse(value);
        } catch {
          throw new Error(`Invalid quoted value for ${key}`);
        }
      }
    } else if (
      value.length >= 2 &&
      value.startsWith("'") &&
      value.endsWith("'")
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

export function parseCredentialsFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Credentials file not found: ${filePath}`);
  }
  return parseCredentialsText(fs.readFileSync(filePath, "utf8"));
}

export function requireCredentials(values, names = ["app_id", "app_secret"]) {
  const missing = names.filter((name) => !values[name]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required credential names: ${missing.join(", ")}`
    );
  }
}
