import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { CaseStatus, Severity, StageId } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrPrecise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatINR(value: number, precise = false): string {
  return (precise ? inrPrecise : inr).format(value);
}

/** Compact Indian notation: ₹4.2 L, ₹1.25 Cr. */
const compact = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

export function formatINRCompact(value: number): string {
  if (Math.abs(value) >= 1_00_00_000) return `₹${compact.format(value / 1_00_00_000)} Cr`;
  if (Math.abs(value) >= 1_00_000) return `₹${compact.format(value / 1_00_000)} L`;
  if (Math.abs(value) >= 1_000) return `₹${compact.format(value / 1_000)} K`;
  return `₹${Math.round(value)}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

const IST = "Asia/Kolkata";

export function formatDateIST(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: IST,
  }).format(new Date(iso));
}

/** 13 Nov 2026, 16:57 IST — timezone is always explicit in the console. */
export function formatDateTimeIST(iso: string): string {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: IST,
  }).format(new Date(iso));
  return `${formatted} IST`;
}

export function formatTimeIST(iso: string): string {
  return `${new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: IST,
  }).format(new Date(iso))} IST`;
}

export function formatRelative(iso: string, now = new Date()): string {
  const then = new Date(iso).getTime();
  const diff = Math.round((then - now.getTime()) / 1000);
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(diff, "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function middleEllipsis(value: string, head = 10, tail = 8): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function maskAccount(accountId: string): string {
  if (accountId.length <= 4) return "••••";
  return `••••${accountId.slice(-4)}`;
}

export async function sha256Hex(data: string | ArrayBuffer): Promise<string> {
  const bytes =
    typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const SEVERITY_ORDER: Record<Severity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

export const CASE_STATUSES: CaseStatus[] = [
  "NEW",
  "TRIAGE",
  "INVESTIGATING",
  "DECIDED",
  "FILED",
  "CLOSED",
];

export const ALLOWED_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  NEW: ["TRIAGE"],
  TRIAGE: ["INVESTIGATING", "CLOSED"],
  INVESTIGATING: ["DECIDED"],
  DECIDED: ["FILED", "CLOSED"],
  FILED: [],
  CLOSED: [],
};

export const STAGE_META: Record<
  StageId,
  { label: string; short: string; href: string; description: string }
> = {
  ingest: {
    label: "Alert ingestion",
    short: "Ingest",
    href: "/app/ingest",
    description: "Validate, deduplicate and quarantine incoming alert and transaction feeds.",
  },
  correlate: {
    label: "Alert correlation",
    short: "Correlate",
    href: "/app/correlate",
    description: "Cluster related alerts into candidate cases and suppress merchant hubs.",
  },
  score: {
    label: "ML risk assessment",
    short: "Risk",
    href: "/app/score",
    description: "Score the case and show the features that moved the probability.",
  },
  graph: {
    label: "Graph money trail",
    short: "Money trail",
    href: "/app/graph",
    description: "Trace directed fund movement across accounts, devices and beneficiaries.",
  },
  evidence: {
    label: "Evidence management",
    short: "Evidence",
    href: "/app/evidence",
    description: "Seal each artifact into a SHA-256 hash chain and verify it on demand.",
  },
  investigate: {
    label: "Investigation & decision",
    short: "Decision",
    href: "/app/cases",
    description: "Record findings, propose a decision and pass it through maker-checker review.",
  },
  report: {
    label: "Regulatory reporting",
    short: "Reporting",
    href: "/app/reports",
    description: "Check completeness, preview and prepare the filing for compliance sign-off.",
  },
};

export const STAGES: StageId[] = [
  "ingest",
  "correlate",
  "score",
  "graph",
  "evidence",
  "investigate",
  "report",
];

export const GROUNDS_OPTIONS = [
  { value: "RAPID_FAN_OUT", label: "Rapid fan-out" },
  { value: "PASS_THROUGH_90PCT", label: "Pass-through ≥ 90%" },
  { value: "SHARED_DEVICE_MULE_RING", label: "Shared-device mule ring" },
  { value: "FAN_IN_STRUCTURING", label: "Fan-in structuring" },
  { value: "PROFILE_MISMATCH", label: "Profile mismatch" },
  { value: "LAYERED_TRANSFERS", label: "Layered transfers" },
] as const;

export const DECISION_TYPES = [
  { value: "FILE_STR", label: "File STR", description: "Suspicious Transaction Report to FIU-IND" },
  { value: "FILE_CPFIR", label: "File CPFIR", description: "Central Payment Fraud Info Registry via RBI DAKSH" },
  { value: "MONITOR", label: "Monitor", description: "Keep the case open for further observation" },
  { value: "CLOSE", label: "Close", description: "No further action; close the case" },
] as const;

export const ROLE_LABEL = {
  investigator: "Investigator",
  lead: "Team lead",
  compliance: "Compliance officer",
} as const;

export const ROLE_DESCRIPTION = {
  investigator: "Ingest, correlate, investigate and propose decisions.",
  lead: "Review cases and approve decisions as the checker.",
  compliance: "Review evidence, generate filings and export the audit log.",
} as const;

export function initials(name: string): string {
  return name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

export function riskBandFromScore(score: number): Severity {
  if (score >= 0.85) return "CRITICAL";
  if (score >= 0.7) return "HIGH";
  if (score >= 0.4) return "MEDIUM";
  return "LOW";
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Deterministic pseudo-random generator so mock data is stable across reloads. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
