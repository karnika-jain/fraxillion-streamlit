import {
  Boxes,
  FileSearch,
  FileText,
  Gauge,
  GitBranch,
  LayoutDashboard,
  Network,
  ScrollText,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export interface Segment {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  description: string;
  group: "workflow" | "governance";
}

/** The seven working segments from the Streamlit app, in their original order. */
export const SEGMENTS: Segment[] = [
  {
    href: "/app",
    label: "Overview",
    short: "OV",
    icon: LayoutDashboard,
    description: "Dataset status and the next workflow step",
    group: "workflow",
  },
  {
    href: "/app/ingest",
    label: "Ingest",
    short: "01",
    icon: Boxes,
    description: "Load, validate and deduplicate feeds",
    group: "workflow",
  },
  {
    href: "/app/correlate",
    label: "Correlate",
    short: "02",
    icon: GitBranch,
    description: "Cluster alerts into candidate cases",
    group: "workflow",
  },
  {
    href: "/app/score",
    label: "ML Score",
    short: "03",
    icon: Gauge,
    description: "Explainable case risk assessment",
    group: "workflow",
  },
  {
    href: "/app/graph",
    label: "Graph",
    short: "04",
    icon: Network,
    description: "Money-trail network and typologies",
    group: "workflow",
  },
  {
    href: "/app/cases",
    label: "Cases",
    short: "05",
    icon: FileSearch,
    description: "Case 360, decisions and maker-checker",
    group: "workflow",
  },
  {
    href: "/app/evidence",
    label: "Evidence",
    short: "06",
    icon: ShieldCheck,
    description: "SHA-256 hash chain and custody",
    group: "workflow",
  },
  {
    href: "/app/reports",
    label: "Reports",
    short: "07",
    icon: FileText,
    description: "PFR and STR previews and registration",
    group: "workflow",
  },
  {
    href: "/app/audit",
    label: "Audit log",
    short: "AU",
    icon: ScrollText,
    description: "Append-only record of every action",
    group: "governance",
  },
];

export function segmentForPath(pathname: string): Segment | undefined {
  return SEGMENTS.find((s) => (s.href === "/app" ? pathname === "/app" : pathname.startsWith(s.href)));
}
