import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { DEFAULT_TOKEN_CACHE } from "./constants.js";

function encodePowerShellScript(script) {
  return Buffer.from(script, "utf16le").toString("base64");
}

function runPowerShell(script, inputText) {
  return spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      encodePowerShellScript(script)
    ],
    {
      input: inputText,
      encoding: "utf8",
      windowsHide: true
    }
  );
}

export function resolveTokenCachePath(inputPath, credentialsPath) {
  if (inputPath) {
    return path.resolve(process.cwd(), inputPath);
  }
  return path.join(path.dirname(credentialsPath), DEFAULT_TOKEN_CACHE);
}

export function persistToken(token, filePath) {
  if (process.platform !== "win32") {
    throw new Error(
      "Encrypted token persistence is currently supported only on Windows"
    );
  }

  const script = [
    "Add-Type -AssemblyName System.Security;",
    "$plain = [Console]::In.ReadToEnd();",
    "$bytes = [Text.Encoding]::UTF8.GetBytes($plain);",
    "$protected = [System.Security.Cryptography.ProtectedData]::Protect(",
    "  $bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser",
    ");",
    "[Convert]::ToBase64String($protected)"
  ].join(" ");

  const result = runPowerShell(script, token);
  if (result.error || result.status !== 0 || !result.stdout.trim()) {
    throw new Error("Could not encrypt the JWT token cache");
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, `${result.stdout.trim()}\n`, "utf8");
  fs.renameSync(tempPath, filePath);
}

export function loadPersistedToken(filePath) {
  if (process.platform !== "win32") {
    throw new Error(
      "Encrypted token persistence is currently supported only on Windows"
    );
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`Token cache not found: ${filePath}`);
  }

  const encrypted = fs.readFileSync(filePath, "utf8");
  const script = [
    "Add-Type -AssemblyName System.Security;",
    "$encrypted = [Console]::In.ReadToEnd();",
    "$protected = [Convert]::FromBase64String($encrypted.Trim());",
    "$bytes = [System.Security.Cryptography.ProtectedData]::Unprotect(",
    "  $protected, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser",
    ");",
    "[Text.Encoding]::UTF8.GetString($bytes)"
  ].join(" ");

  const result = runPowerShell(script, encrypted);
  if (result.error || result.status !== 0 || !result.stdout.trim()) {
    throw new Error("Could not decrypt the JWT token cache");
  }

  return result.stdout.trim();
}
