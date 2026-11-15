import type { StageId } from "@/types";

/**
 * Maps a workflow stage to the console segment that owns it. The case id is a
 * query parameter on global segments and a path segment for the case workspace.
 */
export function stageHref(stage: StageId, caseId?: string): string {
  const query = caseId ? `?case=${encodeURIComponent(caseId)}` : "";
  switch (stage) {
    case "ingest":
      return "/app/ingest";
    case "correlate":
      return "/app/correlate";
    case "score":
      return `/app/score${query}`;
    case "graph":
      return `/app/graph${query}`;
    case "evidence":
      return `/app/evidence${query}`;
    case "investigate":
      return caseId ? `/app/cases/${encodeURIComponent(caseId)}` : "/app/cases";
    case "report":
      return `/app/reports${query}`;
  }
}

/** Read a `?case=` value without inventing a fallback case id. */
export function pickCaseParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
