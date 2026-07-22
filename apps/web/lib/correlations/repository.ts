import "server-only";

import {
  MAX_CASE_CORRELATIONS,
  MAX_CORRELATION_SOURCES,
  type CaseCorrelationCollection,
} from "@/lib/correlations/contracts";
import { serialiseCorrelations, type CorrelationRow } from "@/lib/correlations/serialise";
import { getDatabaseClient } from "@/lib/db/client";

export async function getCaseCorrelations(caseId: string): Promise<CaseCorrelationCollection | null> {
  const sql = getDatabaseClient();
  const [record] = await sql<{ id: string }[]>`SELECT id FROM cases WHERE id = ${caseId} LIMIT 1`;
  if (!record) return null;

  const rows = await sql<CorrelationRow[]>`
    WITH correlated AS (
      SELECT o.kind, o.value, count(*)::integer AS source_count,
        sum(o.occurrences)::integer AS total_occurrences
      FROM source_observations o
      JOIN source_material s ON s.id = o.source_id
      WHERE s.case_id = ${caseId} AND s.status = 'ready'
      GROUP BY o.kind, o.value
      HAVING count(*) > 1
      ORDER BY source_count DESC, total_occurrences DESC, o.kind, o.value
      LIMIT ${MAX_CASE_CORRELATIONS}
    )
    SELECT correlated.kind, correlated.value, correlated.source_count,
      correlated.total_occurrences, detail.source_id, detail.original_filename,
      detail.occurrences
    FROM correlated
    JOIN LATERAL (
      SELECT s.id AS source_id, s.original_filename, o.occurrences
      FROM source_observations o
      JOIN source_material s ON s.id = o.source_id
      WHERE s.case_id = ${caseId} AND s.status = 'ready'
        AND o.kind = correlated.kind AND o.value = correlated.value
      ORDER BY o.occurrences DESC, s.original_filename, s.id
      LIMIT ${MAX_CORRELATION_SOURCES}
    ) detail ON true
    ORDER BY correlated.source_count DESC, correlated.total_occurrences DESC,
      correlated.kind, correlated.value, detail.occurrences DESC,
      detail.original_filename, detail.source_id`;

  return serialiseCorrelations(rows);
}
