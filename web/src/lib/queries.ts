"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { CaseStatus, DecisionInput, DecisionType } from "@/types";

/**
 * Query keys are hierarchical so a mutation can invalidate only the slices it
 * actually changed (for example, sealing evidence invalidates the evidence
 * list and the workflow guide, not the whole model metrics cache).
 */
export const qk = {
  state: ["workflow-state"] as const,
  dataset: ["dataset"] as const,
  overview: ["overview"] as const,
  alerts: (params?: object) => ["alerts", params ?? {}] as const,
  transactions: (params?: object) => ["transactions", params ?? {}] as const,
  correlation: ["correlation"] as const,
  cases: (params?: object) => ["cases", params ?? {}] as const,
  case: (id: string) => ["case", id] as const,
  risk: (id: string, model: string) => ["risk", id, model] as const,
  graph: (id: string, hops: number) => ["graph", id, hops] as const,
  metrics: ["model-metrics"] as const,
  evidence: (caseId?: string) => ["evidence", caseId ?? "all"] as const,
  reports: (id: string) => ["reports", id] as const,
  audit: (params?: object) => ["audit", params ?? {}] as const,
};

function invalidateCore(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: qk.state });
  void qc.invalidateQueries({ queryKey: qk.overview });
  void qc.invalidateQueries({ queryKey: qk.dataset });
}

/* ------------------------------------------------------------------ */
/* Workflow guidance and dataset lifecycle                             */
/* ------------------------------------------------------------------ */

export function useWorkflowState() {
  return useQuery({ queryKey: qk.state, queryFn: () => api.getState() });
}

export function useDataset() {
  return useQuery({ queryKey: qk.dataset, queryFn: () => api.getDataset() });
}

export function useLoadDataset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.loadDataset(),
    onSuccess: (data) => {
      toast.success("Sample dataset loaded", {
        description: `${data.transactions.accepted.toLocaleString("en-IN")} transactions · ${data.alerts.accepted.toLocaleString("en-IN")} alerts`,
      });
      void qc.invalidateQueries();
    },
    onError: (error: Error) => toast.error("Could not load sample data", { description: error.message }),
  });
}

export function useResetDataset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.resetDataset(),
    onSuccess: () => {
      toast.success("Database reset", { description: "Every table and generated artifact is empty." });
      void qc.invalidateQueries();
    },
    onError: (error: Error) => toast.error("Reset failed", { description: error.message }),
  });
}

/* ------------------------------------------------------------------ */
/* Overview, queues                                                    */
/* ------------------------------------------------------------------ */

export function useOverview() {
  return useQuery({ queryKey: qk.overview, queryFn: () => api.getOverview() });
}

export function useAlerts(params?: {
  severity?: string;
  q?: string;
  linked?: "yes" | "no";
  limit?: number;
  offset?: number;
}) {
  return useQuery({ queryKey: qk.alerts(params), queryFn: () => api.listAlerts(params) });
}

export function useTransactions(params?: { q?: string; limit?: number; offset?: number }) {
  return useQuery({ queryKey: qk.transactions(params), queryFn: () => api.listTransactions(params) });
}

/* ------------------------------------------------------------------ */
/* Ingest                                                              */
/* ------------------------------------------------------------------ */

export function useIngestSample() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (kind: "alerts" | "transactions" | "dirty") => api.ingestSample(kind),
    onSuccess: (result, kind) => {
      toast.success(`Ingested ${kind === "dirty" ? "dirty alert" : kind} sample`, {
        description: `${result.accepted} accepted · ${result.duplicates} duplicates · ${result.rejected.length} rejected`,
      });
      void qc.invalidateQueries({ queryKey: ["alerts"] });
      void qc.invalidateQueries({ queryKey: ["transactions"] });
      invalidateCore(qc);
    },
    onError: (error: Error) => toast.error("Ingest failed", { description: error.message }),
  });
}

export function useIngestRows() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, rows }: { kind: "alerts" | "transactions"; rows: Record<string, unknown>[] }) =>
      api.ingestRows(kind, rows),
    onSuccess: (result) => {
      toast.success("Rows ingested", {
        description: `${result.accepted} accepted · ${result.duplicates} duplicates · ${result.rejected.length} rejected`,
      });
      void qc.invalidateQueries({ queryKey: ["alerts"] });
      void qc.invalidateQueries({ queryKey: ["transactions"] });
      invalidateCore(qc);
    },
    onError: (error: Error) => toast.error("Ingest failed", { description: error.message }),
  });
}

export function useUploadCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, kind }: { file: File; kind: "alerts" | "transactions" }) =>
      api.uploadCsv(file, kind),
    onSuccess: (result) => {
      toast.success("CSV ingested", {
        description: `${result.accepted} accepted · ${result.duplicates} duplicates · ${result.rejected.length} rejected`,
      });
      void qc.invalidateQueries({ queryKey: ["alerts"] });
      void qc.invalidateQueries({ queryKey: ["transactions"] });
      invalidateCore(qc);
    },
    onError: (error: Error) => toast.error("Upload failed", { description: error.message }),
  });
}

/* ------------------------------------------------------------------ */
/* Correlation                                                         */
/* ------------------------------------------------------------------ */

export function useCorrelation() {
  return useQuery({ queryKey: qk.correlation, queryFn: () => api.getCorrelation() });
}

export function useRunCorrelation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { hubThreshold: number; maxCaseSize: number }) => api.runCorrelation(params),
    onSuccess: (result) => {
      toast.success("Correlation finished", {
        description: `${result.candidates.length} candidate cases · ${result.droppedHubs.length} hub(s) suppressed`,
      });
      void qc.invalidateQueries({ queryKey: qk.correlation });
      invalidateCore(qc);
    },
    onError: (error: Error) => toast.error("Correlation failed", { description: error.message }),
  });
}

export function useAcceptCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ candidateId, actor }: { candidateId: string; actor: string }) =>
      api.acceptCandidate(candidateId, actor),
    onSuccess: (result) => {
      toast.success(`Case ${result.caseId} created`, { description: result.message });
      void qc.invalidateQueries({ queryKey: qk.correlation });
      void qc.invalidateQueries({ queryKey: ["cases"] });
      invalidateCore(qc);
    },
    onError: (error: Error) => toast.error("Could not accept candidate", { description: error.message }),
  });
}

/* ------------------------------------------------------------------ */
/* Cases, risk, graph                                                  */
/* ------------------------------------------------------------------ */

export function useCases(params?: { status?: string; severity?: string }) {
  return useQuery({ queryKey: qk.cases(params), queryFn: () => api.listCases(params) });
}

export function useCase(caseId?: string | null) {
  return useQuery({
    queryKey: qk.case(caseId ?? ""),
    queryFn: () => api.getCase(caseId as string),
    enabled: Boolean(caseId),
  });
}

export function useRisk(caseId?: string | null, model = "RandomForest") {
  return useQuery({
    queryKey: qk.risk(caseId ?? "", model),
    queryFn: () => api.getRisk(caseId as string, model),
    enabled: Boolean(caseId),
  });
}

export function useGraph(caseId?: string | null, hops = 2) {
  return useQuery({
    queryKey: qk.graph(caseId ?? "", hops),
    queryFn: () => api.getGraph(caseId as string, hops),
    enabled: Boolean(caseId),
    retry: false,
  });
}

export function useEvalMetrics() {
  return useQuery({ queryKey: qk.metrics, queryFn: () => api.getEvalMetrics() });
}

function invalidateCase(qc: ReturnType<typeof useQueryClient>, caseId: string) {
  void qc.invalidateQueries({ queryKey: qk.case(caseId) });
  void qc.invalidateQueries({ queryKey: qk.risk(caseId, "RandomForest") });
  void qc.invalidateQueries({ queryKey: qk.risk(caseId, "LogisticRegression") });
  void qc.invalidateQueries({ queryKey: ["cases"] });
  void qc.invalidateQueries({ queryKey: qk.audit({}) });
  invalidateCore(qc);
}

export function useTransitionCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ caseId, status, actor, reason }: { caseId: string; status: CaseStatus; actor: string; reason?: string }) =>
      api.transitionCase(caseId, status, actor, reason ?? ""),
    onSuccess: (_data, variables) => {
      toast.success(`Case moved to ${variables.status}`);
      invalidateCase(qc, variables.caseId);
    },
    onError: (error: Error) => toast.error("Transition rejected", { description: error.message }),
  });
}

export function useProposeDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ caseId, input }: { caseId: string; input: DecisionInput }) =>
      api.proposeDecision(caseId, input),
    onSuccess: (_data, variables) => {
      toast.success("Decision proposed", { description: "A different user must approve it." });
      invalidateCase(qc, variables.caseId);
    },
    onError: (error: Error) => toast.error("Decision rejected", { description: error.message }),
  });
}

export function useApproveDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ decisionId, checker }: { decisionId: number; checker: string; caseId: string }) =>
      api.approveDecision(decisionId, checker),
    onSuccess: (_data, variables) => {
      toast.success("Decision approved", { description: "The case is now DECIDED." });
      invalidateCase(qc, variables.caseId);
    },
    onError: (error: Error) => toast.error("Approval rejected", { description: error.message }),
  });
}

export function useRejectDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ decisionId, checker, reason }: { decisionId: number; checker: string; caseId: string; reason?: string }) =>
      api.rejectDecision(decisionId, checker, reason ?? ""),
    onSuccess: (_data, variables) => {
      toast.success("Decision rejected");
      invalidateCase(qc, variables.caseId);
    },
    onError: (error: Error) => toast.error("Rejection failed", { description: error.message }),
  });
}

export function useFileCase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ caseId, actor }: { caseId: string; actor: string }) => api.fileCase(caseId, actor),
    onSuccess: (_data, variables) => {
      toast.success("Case filed");
      invalidateCase(qc, variables.caseId);
    },
    onError: (error: Error) => toast.error("Filing failed", { description: error.message }),
  });
}

/* ------------------------------------------------------------------ */
/* Evidence                                                            */
/* ------------------------------------------------------------------ */

export function useEvidence(caseId?: string | null) {
  return useQuery({ queryKey: qk.evidence(caseId ?? undefined), queryFn: () => api.listEvidence(caseId ?? undefined) });
}

export function useVerifyChain() {
  return useMutation({
    mutationFn: () => api.verifyChain(),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success("Chain intact", { description: result.message });
      } else {
        toast.error("Tamper detected", { description: result.message });
      }
    },
    onError: (error: Error) => toast.error("Verification failed", { description: error.message }),
  });
}

export function useTamperEvidence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: number) => api.tamperEvidence(itemId),
    onSuccess: (result) => {
      toast.warning("Evidence altered on disk", { description: result.message });
      void qc.invalidateQueries({ queryKey: ["evidence"] });
    },
    onError: (error: Error) => toast.error("Tamper simulation failed", { description: error.message }),
  });
}

export function useRestoreEvidence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: number) => api.restoreEvidence(itemId),
    onSuccess: (result) => {
      toast.success("Original bytes restored", { description: result.message });
      void qc.invalidateQueries({ queryKey: ["evidence"] });
    },
    onError: (error: Error) => toast.error("Restore failed", { description: error.message }),
  });
}

export function useAttachSampleEvidence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ caseId, actor }: { caseId: string; actor: string }) =>
      api.attachSampleEvidence(caseId, actor),
    onSuccess: () => {
      toast.success("Evidence sealed", { description: "A new link was appended to the chain." });
      void qc.invalidateQueries({ queryKey: ["evidence"] });
      void qc.invalidateQueries({ queryKey: ["case"] });
      invalidateCore(qc);
    },
    onError: (error: Error) => toast.error("Attach failed", { description: error.message }),
  });
}

export function useUploadEvidence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ caseId, file, kind, actor }: { caseId: string; file: File; kind: string; actor: string }) =>
      api.uploadEvidence(caseId, file, kind, actor),
    onSuccess: () => {
      toast.success("Evidence sealed", { description: "The uploaded artifact was hashed into the chain." });
      void qc.invalidateQueries({ queryKey: ["evidence"] });
      void qc.invalidateQueries({ queryKey: ["case"] });
      invalidateCore(qc);
    },
    onError: (error: Error) => toast.error("Upload failed", { description: error.message }),
  });
}

/* ------------------------------------------------------------------ */
/* Reports                                                             */
/* ------------------------------------------------------------------ */

export function useReports(caseId?: string | null) {
  return useQuery({
    queryKey: qk.reports(caseId ?? ""),
    queryFn: () => api.getReports(caseId as string),
    enabled: Boolean(caseId),
  });
}

export function useGenerateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ caseId, regime, actor }: { caseId: string; regime: "PFR" | "STR"; actor: string }) =>
      api.generateReport(caseId, regime, actor),
    onSuccess: (result, variables) => {
      if (result.ok) {
        toast.success(`${variables.regime} generated`, { description: result.filename });
      } else {
        toast.error(`${variables.regime} blocked by validation`, { description: result.errors[0] });
      }
      void qc.invalidateQueries({ queryKey: qk.reports(variables.caseId) });
      invalidateCore(qc);
    },
    onError: (error: Error) => toast.error("Generation failed", { description: error.message }),
  });
}

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */

export function useAudit(params?: { case_id?: string; action?: string; actor?: string; limit?: number }) {
  return useQuery({ queryKey: qk.audit(params), queryFn: () => api.listAudit(params) });
}

export const DECISION_LABEL: Record<DecisionType, string> = {
  FILE_STR: "File STR",
  FILE_CPFIR: "File CPFIR",
  MONITOR: "Monitor",
  CLOSE: "Close",
};
