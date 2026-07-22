import { z } from "zod";

export const MAX_SOURCE_BYTES = 1024 * 1024;
export const sourceMediaTypes = ["text/plain", "text/csv", "application/json"] as const;
export const observationKinds = ["email", "url", "ipv4", "domain"] as const;
export type ObservationKind = (typeof observationKinds)[number];

const extensionByMediaType: Record<(typeof sourceMediaTypes)[number], ReadonlySet<string>> = {
  "text/plain": new Set(["txt", "log"]),
  "text/csv": new Set(["csv"]),
  "application/json": new Set(["json"]),
};

export type SourceUploadInput = {
  filename: string;
  mediaType: (typeof sourceMediaTypes)[number];
  bytes: Uint8Array;
};

export type SourceObservation = { id: string; kind: ObservationKind; value: string; occurrences: number };
export type SourceRecord = {
  id: string;
  originalFilename: string;
  mediaType: string;
  sizeBytes: number;
  sha256: string;
  status: "queued" | "processing" | "ready" | "failed";
  failureReason: string | null;
  createdAt: string;
  processedAt: string | null;
  characterCount: number | null;
  lineCount: number | null;
  wordCount: number | null;
  observations: SourceObservation[];
};

function safeFilename(value: string) {
  const leaf = value.replaceAll("\\", "/").split("/").pop()?.trim() ?? "";
  return leaf.replace(/[^A-Za-z0-9._ -]/g, "_").replace(/\s+/g, " ").slice(0, 120);
}

export function validateSourceUpload(value: { name: string; type: string; size: number; bytes: Uint8Array }): SourceUploadInput {
  const filename = safeFilename(value.name);
  if (!filename || filename.startsWith(".")) throw new Error("INVALID_FILENAME");
  if (value.size < 1 || value.size > MAX_SOURCE_BYTES || value.bytes.byteLength !== value.size) throw new Error("INVALID_SIZE");

  const extension = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
  const inferredType = extension === "json" ? "application/json" : extension === "csv" ? "text/csv"
    : extension === "txt" || extension === "log" ? "text/plain" : null;
  if (!inferredType) throw new Error("INVALID_EXTENSION");
  const declaredType = value.type.split(";", 1)[0].trim().toLowerCase();
  if (declaredType && declaredType !== "application/octet-stream" && declaredType !== inferredType) throw new Error("INVALID_MEDIA_TYPE");
  const mediaType = inferredType;
  if (!extensionByMediaType[mediaType].has(extension)) throw new Error("INVALID_EXTENSION");

  const text = new TextDecoder("utf-8", { fatal: true }).decode(value.bytes);
  if (text.includes("\0")) throw new Error("INVALID_TEXT");
  if (mediaType === "application/json") {
    try { JSON.parse(text); } catch { throw new Error("INVALID_JSON"); }
  }
  return { filename, mediaType, bytes: value.bytes };
}

export const caseIdSchema = z.string().uuid();
