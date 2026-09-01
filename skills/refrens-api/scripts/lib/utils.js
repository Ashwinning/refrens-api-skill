import fs from "node:fs";

export function cloneJson(value) {
  if (value === undefined) {
    return undefined;
  }
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

export function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

export function deepMerge(baseValue, overrideValue) {
  if (overrideValue === undefined) {
    return cloneJson(baseValue);
  }
  if (Array.isArray(baseValue) && Array.isArray(overrideValue)) {
    return cloneJson(overrideValue);
  }
  if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
    const merged = {};
    for (const key of new Set([
      ...Object.keys(baseValue),
      ...Object.keys(overrideValue)
    ])) {
      merged[key] = deepMerge(baseValue[key], overrideValue[key]);
    }
    return merged;
  }
  return cloneJson(overrideValue);
}

export function omit(objectValue, keysToOmit) {
  const result = {};
  for (const [key, value] of Object.entries(objectValue)) {
    if (!keysToOmit.includes(key)) {
      result[key] = cloneJson(value);
    }
  }
  return result;
}

export function readJsonFile(filePath, maxBytes) {
  const raw = fs.readFileSync(filePath);
  if (raw.length > maxBytes) {
    throw new Error(`JSON file exceeds safe size limit: ${filePath}`);
  }
  return JSON.parse(raw.toString("utf8"));
}

export function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .filter((key) => value[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

export function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function writeJson(output, stream = process.stdout) {
  stream.write(`${JSON.stringify(output, null, 2)}\n`);
}
