import { describe, expect, test } from "bun:test";

import { validateSourceUpload } from "@/lib/sources/contracts";

describe("validateSourceUpload", () => {
  test("accepts and sanitises a small UTF-8 text source", () => {
    const bytes = new TextEncoder().encode("Synthetic record\n192.0.2.4");
    const result = validateSourceUpload({ name: "folder/incident?.txt", type: "text/plain", size: bytes.length, bytes });
    expect(result.filename).toBe("incident_.txt");
  });

  test("rejects executable and malformed JSON uploads", () => {
    const executable = new TextEncoder().encode("synthetic");
    expect(() => validateSourceUpload({ name: "source.exe", type: "application/octet-stream", size: executable.length, bytes: executable })).toThrow("INVALID_EXTENSION");
    const malformed = new TextEncoder().encode("{not-json}");
    expect(() => validateSourceUpload({ name: "source.json", type: "application/json", size: malformed.length, bytes: malformed })).toThrow("INVALID_JSON");
  });
});
