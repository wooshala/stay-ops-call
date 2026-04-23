import { createHash } from "crypto";

export function buildFileFingerprint(input: {
  name: string;
  bytes: number;
  mtime: string;
}): string {
  const base = `${input.name.toLowerCase()}|${input.bytes}|${input.mtime}`;
  return createHash("sha256").update(base).digest("hex");
}

export function buildFallbackFingerprint(input: {
  name: string;
  bytes: number;
}): string {
  const base = `${input.name.toLowerCase()}|${input.bytes}`;
  return createHash("sha256").update(base).digest("hex");
}
