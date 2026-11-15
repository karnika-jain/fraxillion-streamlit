// Types mirror the live FastAPI contract in api/main.py, which in turn
// serialises the project's SQLite schema and core/* modules. There is no
// fixture layer: every field below is returned by the Python service.

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type AlertSeverity = "HIGH" | "MEDIUM" | "LOW";
export type CaseStatus = "NEW" | "TRIAGE" | "INVESTIGATING" | "DECIDED" | "FILED" | "CLOSED";
export type DecisionStatus = "PENDING" | "APPROVED" | "REJECTED";
export type DecisionType = "FILE_STR" | "FILE_CPFIR" | "MONITOR" | "CLOSE";
export type EvidenceKind = "DOCUMENT" | "SCREENSHOT" | "DATASET" | "COMMUNICATION" | "BANK_STATEMENT";
export type EvidenceState = "VERIFIED" | "MISMATCH" | "PENDING";
export type ReportRegime = "PFR" | "STR";
export type Channel = "UPI" | "IMPS" | "NEFT" | "CARD" | "RTGS";
export type Role = "investigator" | "lead" | "compliance";

/** UI-only stage identifier for the seven-step workflow guide. */
export type StageId =
  | "ingest"
  | "correlate"
  | "score"
  | "graph"
  | "evidence"
  | "investigate"
  | "report";

export interface Alert {
  alertId: string;
  txnId: string;
  accountId: string;
  deviceId: string | null;
  toVpa: string | null;
  rule: string;
  severity: AlertSeverity;
  score: number;
  reason: string;
  ts: string;
  isFraud: boolean;
  caseId: string | null;
}

export interface AlertList {
  items: Alert[];
  total: number;
  unlinked: number;
  severityCounts: Record<string, number>;
}

export interface Transaction {
  txnId: string;
  ts: string;
  fromAccount: string;
  toAccount: string;
  toVpa: string;
  amount: number;
  channel: Channel;
  deviceId: string;
  city: string;
  isFraud: boolean;
}

export interface TransactionList {
  items: Transaction[];
  total: number;
}

export interface Candidate {
  id: string;
  alerts: string[];
  sharedKeys: string[];
  totalAmount: number;
  distinctBeneficiaries: number;
  highestSeverity: Severity;
  alertCount: number;
  acceptedCaseId: string | null;
}

export interface DroppedHub {
  key: string;
  alertCount: number;
  reason: string;
}

export interface CorrelationResult {
  candidates: Candidate[];
  droppedHubs: DroppedHub[];
  skippedOversized: { size: number; reason: string }[];
  runAt: string | null;
  parameters: { hubThreshold: number; maxCaseSize: number };
  alertsConsidered: number;
}

export interface CaseSummary {
  caseId: string;
  title: string;
  status: CaseStatus;
  severity: Severity;
  amount: number;
  sharedKeys: string[];
  createdAt: string;
  alertCount: number;
  evidenceCount: number;
  decisionCount: number;
  allowedTransitions: CaseStatus[];
}

export interface LinkedAlert extends Alert {
  caseId: string;
}

export interface CaseAccount {
  accountId: string;
  alertCount: number;
}

export interface CaseDetail extends CaseSummary {
  alerts: LinkedAlert[];
  transactions: Transaction[];
  evidence: EvidenceItem[];
  decisions: Decision[];
  audit: AuditEntry[];
  accounts: CaseAccount[];
}

export interface RiskAssessment {
  caseId: string;
  score: number;
  band: Severity;
  model: string;
  reasons: string[];
  scoredAt: string;
}

export interface ThresholdPoint {
  threshold: number;
  precision: number;
  recall: number;
  f1: number;
  flagged_count: number;
}

export interface ModelMetrics {
  name: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  roc_auc: number;
  pr_auc: number;
  confusion_matrix: number[][];
  threshold_curve: ThresholdPoint[];
}

export interface EvalMetrics {
  dataset: {
    total_rows: number;
    train_rows: number;
    test_rows: number;
    fraud_rows_total: number;
    fraud_rate_pct: number;
    split: string;
  };
  features: string[];
  models: Record<string, ModelMetrics>;
  feature_importances: Record<string, number>;
  training_seconds: number;
}

export interface GraphNode {
  id: string;
  inDegree: number;
  outDegree: number;
  amountIn: number;
  amountOut: number;
  role: "focus" | "suspect" | "counterparty";
  x: number;
  y: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  amount: number;
  count: number;
  txnIds: string[];
  firstAt: string;
  lastAt: string;
}

export interface GraphMotifs {
  fanOut: { node: string; targets: number; windowStart: string; totalAmount: number }[];
  fanIn: { node: string; sources: number; windowStart: string; totalAmount: number }[];
  passThrough: { node: string; inflow: number; outflow: number; ratio: number }[];
}

export interface GraphData {
  caseId: string;
  focusAccount: string;
  hops: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  motifs: GraphMotifs;
  timeWindow: { from: string; to: string } | null;
}

export interface EvidenceItem {
  id: number;
  caseId: string;
  path: string;
  filename: string;
  sizeBytes: number;
  exists: boolean;
  kind: EvidenceKind | string;
  fileHash: string;
  prevHash: string;
  itemHash: string;
  createdAt: string;
  /** Client-side state derived from /api/evidence/verify. */
  state?: EvidenceState;
}

export interface ChainVerification {
  ok: boolean;
  checked: number;
  failingId: number | null;
  message: string;
  at: string;
  items: { id: number; state: EvidenceState }[];
}

export interface Decision {
  id: number;
  caseId: string;
  decisionType: DecisionType;
  grounds: string;
  rationale: string;
  maker: string;
  checker: string | null;
  status: DecisionStatus;
  createdAt: string;
  decidedAt: string | null;
}

export interface AuditEntry {
  id: number;
  actor: string;
  action: string;
  objectType: string;
  objectId: string;
  details: string;
  createdAt: string;
}

export interface AuditResponse {
  items: AuditEntry[];
  actions: { action: string; count: number }[];
  actors: { actor: string; count: number }[];
}

export interface ReportContent {
  content: string | null;
  errors: string[];
}

export interface ReportHistoryEntry {
  id: number;
  regime: ReportRegime;
  filename: string;
  path: string;
  sha256: string;
  createdAt: string;
}

export interface ReportPack {
  caseId: string;
  status: CaseStatus;
  eligible: boolean;
  blockedReason: string | null;
  pfr: ReportContent;
  str: ReportContent;
  fmr: { available: boolean; todo: string };
  history: ReportHistoryEntry[];
}

export interface IngestReject {
  row: number | null;
  reason: string;
}

export interface IngestBatchResult {
  received: number;
  accepted: number;
  duplicates: number;
  rejected: IngestReject[];
  durationMs: number;
}

export interface DatasetCounts {
  transactions: number;
  alerts: number;
  cases: number;
  evidence: number;
  decisions: number;
  reports: number;
  auditEntries: number;
}

export interface DatasetState extends DatasetCounts {
  loaded: boolean;
}

export interface WorkflowStep {
  id: string;
  label: string;
  done: boolean;
  href: string;
  detail: string;
}

export interface NextStep {
  id: string;
  title: string;
  description: string;
  href: string;
  action: string;
}

export interface WorkflowState {
  counts: DatasetCounts;
  loaded: boolean;
  statuses: Record<string, number>;
  pendingDecisions: number;
  steps: WorkflowStep[];
  nextStep: NextStep;
}

export interface OverviewData {
  counts: DatasetCounts;
  loaded: boolean;
  unlinkedAlerts: number;
  alertSeverities: Record<string, number>;
  caseStatuses: Record<string, number>;
  pendingDecisions: number;
  recentAlerts: Alert[];
  recentCases: CaseSummary[];
  recentDecisions: Decision[];
  recentAudit: AuditEntry[];
}

export interface SearchResult {
  id: string;
  type: "case" | "account" | "hash" | "alert";
  label: string;
  sublabel: string;
  href: string;
}

export interface CaseTransitionInput {
  status: CaseStatus;
  actor: string;
  reason?: string;
}

export interface DecisionInput {
  decision_type: DecisionType;
  grounds: string;
  rationale: string;
  maker: string;
  evidence_refs?: string;
}
