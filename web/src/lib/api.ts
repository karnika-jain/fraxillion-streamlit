import type {
  AlertList,
  AuditResponse,
  CaseDetail,
  CaseStatus,
  CaseSummary,
  ChainVerification,
  CorrelationResult,
  DatasetState,
  Decision,
  DecisionInput,
  EvalMetrics,
  EvidenceItem,
  GraphData,
  IngestBatchResult,
  OverviewData,
  ReportPack,
  RiskAssessment,
  SearchResult,
  TransactionList,
  WorkflowState,
} from "@/types";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

export const isMockMode = false;
export const API_MODE_LABEL = `Live API · ${API_BASE}`;

function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function upload<T>(path: string, file: File, fields: Record<string, string> = {}): Promise<T> {
  const form = new FormData();
  form.set("file", file);
  const search = new URLSearchParams(fields).toString();
  const res = await fetch(`${API_BASE}${path}${search ? `?${search}` : ""}`, {
    method: "POST",
    body: form,
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Upload failed (${res.status})`);
  }
  return (await res.json()) as T;
}

/** Opens a streaming endpoint (report file, evidence file, evidence bundle). */
export function downloadUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export const api = {
  // Workflow guidance -----------------------------------------------------
  getState: () => request<WorkflowState>("/api/state"),
  getDataset: () => request<DatasetState>("/api/dataset"),
  loadDataset: () => request<{ transactions: IngestBatchResult; alerts: IngestBatchResult; counts: DatasetState }>("/api/dataset/load", { method: "POST" }),
  resetDataset: () => request<{ ok: boolean; counts: DatasetState }>("/api/dataset/reset", { method: "POST" }),

  // Overview --------------------------------------------------------------
  getOverview: () => request<OverviewData>("/api/overview"),

  // Ingest ----------------------------------------------------------------
  listAlerts: (params: { severity?: string; q?: string; linked?: "yes" | "no"; limit?: number; offset?: number } = {}) =>
    request<AlertList>(`/api/alerts${query(params)}`),
  listTransactions: (params: { q?: string; limit?: number; offset?: number } = {}) =>
    request<TransactionList>(`/api/transactions${query(params)}`),
  ingestSample: (kind: "alerts" | "transactions" | "dirty") =>
    request<IngestBatchResult>(`/api/ingest/sample/${kind}`, { method: "POST" }),
  ingestRows: (kind: "alerts" | "transactions", rows: Record<string, unknown>[]) =>
    request<IngestBatchResult>(`/api/ingest/${kind}`, {
      method: "POST",
      body: JSON.stringify({ rows }),
    }),
  uploadCsv: (file: File, kind: "alerts" | "transactions") =>
    upload<IngestBatchResult>("/api/ingest/upload", file, { kind }),

  // Correlation -----------------------------------------------------------
  getCorrelation: () => request<CorrelationResult>("/api/correlate"),
  runCorrelation: (params: { hubThreshold: number; maxCaseSize: number }) =>
    request<CorrelationResult>("/api/correlate/run", {
      method: "POST",
      body: JSON.stringify({ hub_threshold: params.hubThreshold, max_case_size: params.maxCaseSize }),
    }),
  acceptCandidate: (candidateId: string, actor: string) =>
    request<{ caseId: string; message: string }>("/api/correlate/accept", {
      method: "POST",
      body: JSON.stringify({ candidate_id: candidateId, actor }),
    }),

  // Cases, risk, graph ----------------------------------------------------
  listCases: (params: { status?: string; severity?: string } = {}) =>
    request<CaseSummary[]>(`/api/cases${query(params)}`),
  getCase: (caseId: string) => request<CaseDetail>(`/api/cases/${encodeURIComponent(caseId)}`),
  getRisk: (caseId: string, model = "RandomForest") =>
    request<RiskAssessment>(`/api/cases/${encodeURIComponent(caseId)}/risk${query({ model })}`),
  getGraph: (caseId: string, hops = 2) =>
    request<GraphData>(`/api/cases/${encodeURIComponent(caseId)}/graph${query({ hops })}`),
  getEvalMetrics: () => request<EvalMetrics>("/api/model/metrics"),

  transitionCase: (caseId: string, status: CaseStatus, actor: string, reason = "") =>
    request<CaseSummary>(`/api/cases/${encodeURIComponent(caseId)}/transition`, {
      method: "POST",
      body: JSON.stringify({ status, actor, reason }),
    }),
  proposeDecision: (caseId: string, input: DecisionInput) =>
    request<Decision>(`/api/cases/${encodeURIComponent(caseId)}/decisions`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  approveDecision: (decisionId: number, checker: string) =>
    request<{ result: unknown; decision: Decision }>(`/api/decisions/${decisionId}/approve`, {
      method: "POST",
      body: JSON.stringify({ checker }),
    }),
  rejectDecision: (decisionId: number, checker: string, reason = "") =>
    request<{ result: unknown; decision: Decision }>(`/api/decisions/${decisionId}/reject`, {
      method: "POST",
      body: JSON.stringify({ checker, reason }),
    }),
  fileCase: (caseId: string, actor: string) =>
    request<{ caseId: string; status: CaseStatus }>(`/api/cases/${encodeURIComponent(caseId)}/file`, {
      method: "POST",
      body: JSON.stringify({ actor }),
    }),

  // Evidence --------------------------------------------------------------
  listEvidence: (caseId?: string) =>
    request<EvidenceItem[]>(`/api/evidence${query({ case_id: caseId })}`),
  verifyChain: () => request<ChainVerification>("/api/evidence/verify", { method: "POST" }),
  tamperEvidence: (itemId: number) =>
    request<{ id: number; message: string; diskHash: string }>(`/api/evidence/${itemId}/tamper`, { method: "POST" }),
  restoreEvidence: (itemId: number) =>
    request<{ id: number; message: string; diskHash: string }>(`/api/evidence/${itemId}/restore`, { method: "POST" }),
  attachSampleEvidence: (caseId: string, actor: string) =>
    request<EvidenceItem>(`/api/evidence/attach-sample${query({ case_id: caseId, actor })}`, { method: "POST" }),
  uploadEvidence: (caseId: string, file: File, kind: string, actor: string) =>
    upload<EvidenceItem>("/api/evidence/upload", file, { case_id: caseId, kind, actor }),
  evidenceDownloadUrl: (itemId: number) => downloadUrl(`/api/evidence/${itemId}/download`),
  evidenceBundleUrl: (caseId: string) => downloadUrl(`/api/evidence/export${query({ case_id: caseId })}`),

  // Reports ---------------------------------------------------------------
  getReports: (caseId: string) => request<ReportPack>(`/api/cases/${encodeURIComponent(caseId)}/reports`),
  generateReport: (caseId: string, regime: "PFR" | "STR", actor: string) =>
    request<{
      ok: boolean;
      errors: string[];
      filename?: string;
      sha256?: string;
      history: ReportPack["history"];
    }>(`/api/cases/${encodeURIComponent(caseId)}/reports/${regime}${query({ actor })}`, { method: "POST" }),
  reportDownloadUrl: (reportId: number) => downloadUrl(`/api/reports/${reportId}/download`),

  // Audit and search ------------------------------------------------------
  listAudit: (params: { case_id?: string; action?: string; actor?: string; limit?: number } = {}) =>
    request<AuditResponse>(`/api/audit${query(params)}`),
  search: (q: string) => request<SearchResult[]>(`/api/search${query({ q })}`),
};
