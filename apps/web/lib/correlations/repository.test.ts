import { describe, expect, test } from "bun:test";

import { serialiseCorrelations, type CorrelationRow } from "@/lib/correlations/serialise";

describe("serialiseCorrelations", () => {
  test("groups bounded source details and derives a stable summary", () => {
    const rows: CorrelationRow[] = [
      { kind: "domain", value: "example.test", source_count: 2, total_occurrences: 4, source_id: "source-a", original_filename: "a.txt", occurrences: 3 },
      { kind: "domain", value: "example.test", source_count: 2, total_occurrences: 4, source_id: "source-b", original_filename: "b.txt", occurrences: 1 },
      { kind: "ipv4", value: "192.0.2.42", source_count: 2, total_occurrences: 2, source_id: "source-a", original_filename: "a.txt", occurrences: 1 },
      { kind: "ipv4", value: "192.0.2.42", source_count: 2, total_occurrences: 2, source_id: "source-b", original_filename: "b.txt", occurrences: 1 },
    ];

    const collection = serialiseCorrelations(rows);
    expect(collection.summary).toEqual({
      total: 2,
      sourceLinks: 4,
      byKind: { email: 0, url: 0, ipv4: 1, domain: 1, sha256: 0, user_agent: 0 },
    });
    expect(collection.correlations[0]).toEqual(expect.objectContaining({
      kind: "domain",
      sourceCount: 2,
      totalOccurrences: 4,
      sourcesTruncated: false,
      sources: [
        { sourceId: "source-a", sourceFilename: "a.txt", occurrences: 3 },
        { sourceId: "source-b", sourceFilename: "b.txt", occurrences: 1 },
      ],
    }));
  });
});
