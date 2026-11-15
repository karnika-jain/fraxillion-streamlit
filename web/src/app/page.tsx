"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Command,
  FileText,
  Fingerprint,
  GitBranch,
  Landmark,
  Lock,
  Network,
  Scale,
  ShieldCheck,
  Terminal,
  Waypoints,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge, SeverityBadge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "#product", label: "Product" },
  { href: "#workflow", label: "Workflow" },
  { href: "#integrity", label: "Integrity" },
  { href: "#boundaries", label: "Boundaries" },
];

const STEPS = [
  {
    id: "ingest",
    icon: Boxes,
    label: "Ingest",
    kicker: "01 · Landing zone",
    title: "One validated door for every alert.",
    body: "Transaction monitoring, complaints, branch escalations and external feeds land in the same place. Rows are checked against a strict contract, duplicates are suppressed by key, and failures go to quarantine with the exact field and reason.",
    bullets: [
      "Score, timestamp, amount, identifier and severity checks on every row",
      "Duplicate suppression without silently dropping the first observation",
      "Rejected rows are returned with the row number and exact reason",
    ],
    detail: "300 alerts · 5,005 transactions in the sample corpus",
    href: "/app/ingest",
    cta: "Open ingest",
  },
  {
    id: "correlate",
    icon: GitBranch,
    label: "Correlate",
    kicker: "02 · Clustering",
    title: "Turn a queue into a case.",
    body: "Alerts join on shared accounts, devices and beneficiary VPAs. High-degree merchant keys are suppressed before clustering, oversized components are skipped, and every exclusion is reported with its reason.",
    bullets: [
      "Connected components over shared entities",
      "Hub threshold and maximum case size under the investigator's control",
      "Accept a candidate as a case, or inspect its keys first",
    ],
    detail: "Connected components · hub suppression · accepted candidates persist as cases",
    href: "/app/correlate",
    cta: "Open correlation",
  },
  {
    id: "score",
    icon: BrainCircuit,
    label: "ML score",
    kicker: "03 · Risk",
    title: "A probability, with its reasons attached.",
    body: "A calibrated random forest scores the case and attribution shows which features moved it. The threshold is a documented policy choice, not a hidden default, and the model's evaluation is available next to the score.",
    bullets: [
      "Per-case feature contribution, signed and labelled",
      "Threshold exploration without rewriting the stored score",
      "Evaluation metrics from the repository, with synthetic-data caveats",
    ],
    detail: "ROC-AUC 0.9956 · PR-AUC 0.9147 · synthetic evaluation split",
    href: "/app/score",
    cta: "Open risk assessment",
  },
  {
    id: "graph",
    icon: Network,
    label: "Money trail",
    kicker: "04 · Graph",
    title: "Follow value, not a hairball.",
    body: "Directed transfers and shared-device associations are separated visually. Aggregate legs carry amount, channel and time. A path finder answers the question the investigator actually asks: how did money get from here to there?",
    bullets: [
      "Directed transfer edges with amount and channel",
      "Dashed associations for shared devices, never mixed with money flow",
      "Fan-in, fan-out and pass-through motifs listed beside the canvas",
    ],
    detail: "1–3 hops · directed transfers · fan-in / fan-out / pass-through",
    href: "/app/graph",
    cta: "Open money trail",
  },
  {
    id: "evidence",
    icon: Fingerprint,
    label: "Evidence",
    kicker: "05 · Custody",
    title: "Every artifact can prove itself.",
    body: "Each file is hashed with SHA-256 and linked into the global append-only chain. Verification recomputes the file hash and names the exact item that fails. A one-byte change is visible, not buried in a PDF appendix.",
    bullets: [
      "SHA-256 file hash plus a chained item hash",
      "Previous-hash pointers are checked item by item",
      "Mismatch state is explicit and distinct from pending",
    ],
    detail: "Global append-only chain · genesis 64 zeros · IST timestamps",
    href: "/app/evidence",
    cta: "Open evidence",
  },
  {
    id: "investigate",
    icon: Scale,
    label: "Decision",
    kicker: "06 · Investigation",
    title: "Two names before anything moves.",
    body: "The investigator records grounds, a rationale and the evidence they relied on. A lead or compliance officer whose name differs must approve or reject. The minimum rationale length is enforced in the interface, not just in policy.",
    bullets: [
      "Maker-checker enforced by identity, not seniority alone",
      "Grounds are structured, rationale is free text with a minimum",
      "Case status transitions are explicit and auditable",
    ],
    detail: "NEW → TRIAGE → INVESTIGATING → DECIDED → FILED / CLOSED",
    href: "/app/cases",
    cta: "Open case workspace",
  },
  {
    id: "report",
    icon: FileText,
    label: "Reporting",
    kicker: "07 · Filing",
    title: "Prepare the filing from the record.",
    body: "PFR/CPFIR and STR drafts come from the case and its evidence. Completeness is checked field by field. FMR is deliberately unavailable: the source repository has no renderer and this product does not invent one.",
    bullets: [
      "Export only when the case is DECIDED or FILED",
      "Missing required fields block the draft",
      "Unsupported formats are marked TODO, not mocked into existence",
    ],
    detail: "PFR pipe format · STR XML structure · FMR TODO(compliance)",
    href: "/app/reports",
    cta: "Open reports",
  },
] as const;

function LandingNav() {
  const [open, setOpen] = React.useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/80 backdrop-blur-md">
      <div className="container-page flex h-[68px] items-center gap-4">
        <Logo />
        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Landing navigation">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-[12.5px] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Button asChild size="sm">
            <Link href="/app">
              Proceed to use <ArrowRight className="size-3.5" />
            </Link>
          </Button>
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-md border border-border text-ink-2 md:hidden"
            aria-expanded={open}
            aria-controls="landing-mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="space-y-1" aria-hidden>
              <span className="block h-px w-4 bg-current" />
              <span className="block h-px w-4 bg-current" />
            </span>
          </button>
        </div>
      </div>
      {open ? (
        <nav id="landing-mobile-nav" className="border-t border-border bg-bg px-5 py-3 md:hidden" aria-label="Mobile landing navigation">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-2 py-2.5 text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

function HeroPreview() {
  return (
    <div className="relative mx-auto mt-12 w-full max-w-[1080px] md:mt-16">
      <div className="absolute -inset-x-8 -bottom-10 -top-8 -z-10 rounded-[36px] bg-[var(--accent)]/5 blur-2xl" aria-hidden />
      <div className="overflow-hidden rounded-xl border border-border-strong bg-surface shadow-lg md:rounded-2xl">
        <div className="flex h-9 items-center gap-2 border-b border-border bg-surface-2 px-3">
          <span className="flex gap-1" aria-hidden>
            <span className="size-2 rounded-full bg-border-strong" />
            <span className="size-2 rounded-full bg-border-strong" />
            <span className="size-2 rounded-full bg-border-strong" />
          </span>
          <div className="ml-3 hidden items-center gap-1.5 rounded border border-border bg-surface px-2 py-1 font-mono text-[8.5px] text-ink-3 sm:flex">
            <Lock className="size-2.5" aria-hidden /> console.fraxillion.local/app/cases/CS-2026-0001
          </div>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[8px] font-medium text-ink-3">
            illustrative
          </span>
        </div>
        <div className="grid grid-cols-[1fr] sm:grid-cols-[148px_1fr] lg:grid-cols-[168px_1fr_218px]">
          <div className="hidden border-r border-border bg-surface-2 p-2.5 sm:block">
            <div className="flex items-center gap-1.5 px-1.5 pb-2">
              <LogoMark className="size-4 text-accent" />
              <span className="text-[9px] font-semibold tracking-tight text-ink">fraxillion</span>
            </div>
            {["Overview", "Ingest", "Correlate", "ML Score", "Graph", "Cases", "Evidence", "Reports"].map((label, index) => (
              <div
                key={label}
                className={cn(
                  "flex items-center gap-1.5 rounded px-1.5 py-[5px] text-[8.5px]",
                  index === 5 ? "bg-accent-soft font-medium text-accent-ink" : "text-ink-3",
                )}
              >
                <span className={cn("size-1 rounded-full", index === 5 ? "bg-accent" : "bg-border-strong")} aria-hidden />
                {label}
              </div>
            ))}
          </div>

          <div className="min-w-0 p-3 sm:p-4">
            <div className="flex items-center gap-1.5 text-[8px] text-ink-3">
              <span>Console</span><ChevronRight className="size-2.5" aria-hidden /><span>Cases</span>
              <ChevronRight className="size-2.5" aria-hidden /><span className="font-mono text-ink-2">CS-2026-0001</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[10px] font-medium text-ink">CS-2026-0001</span>
              <Badge tone="low" size="sm">investigating</Badge>
              <SeverityBadge severity="HIGH" showIcon={false} />
            </div>
            <p className="mt-1 text-[11px] font-semibold leading-snug text-ink">Rapid fan-out ring · A0181 / D0080</p>
            <p className="mt-1 line-clamp-2 text-[8.5px] leading-relaxed text-ink-3">
              A0181 received a large credit at 23:41 and dispersed funds to eight first-time beneficiaries in 38
              minutes through a device shared with two other accounts.
            </p>

            <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded border border-border bg-border">
              {[
                ["Linked value", "₹12.47 L"],
                ["Alerts", "12"],
                ["Evidence", "5"],
              ].map(([label, value]) => (
                <div key={label} className="bg-surface px-2 py-1.5">
                  <p className="text-[7px] uppercase tracking-[0.06em] text-ink-3">{label}</p>
                  <p className="mt-0.5 font-mono text-[10px] tabular-nums text-ink">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded border border-border bg-surface-2 p-2">
              <div className="flex items-center justify-between">
                <span className="text-[7.5px] font-medium uppercase tracking-[0.07em] text-ink-3">Money trail</span>
                <span className="font-mono text-[7px] text-ink-3">2 hops · 38 min</span>
              </div>
              <svg viewBox="0 0 340 112" className="mt-1 w-full" role="img" aria-label="Illustrative money-trail graph with one focus account and several beneficiaries">
                <g stroke="var(--graph-edge)" strokeWidth="1" fill="none">
                  <path d="M170 56 78 26M170 56 63 54M170 56 82 84M170 56 262 25M170 56 281 55M170 56 260 88" />
                  <path d="M262 25 315 44M260 88 314 76" strokeDasharray="3 3" />
                </g>
                <g>
                  <circle cx="170" cy="56" r="13" fill="var(--graph-focus)" />
                  <text x="170" y="59" textAnchor="middle" fontSize="7" fill="var(--accent-fg)" fontFamily="monospace">A0181</text>
                  {[
                    [78, 26], [63, 54], [82, 84], [262, 25], [281, 55], [260, 88],
                  ].map(([x, y]) => (
                    <circle key={`${x}-${y}`} cx={x} cy={y} r="8" fill="var(--graph-node)" stroke="var(--graph-edge)" />
                  ))}
                  <circle cx="315" cy="44" r="6" fill="var(--critical-soft)" stroke="var(--critical)" />
                  <circle cx="314" cy="76" r="6" fill="var(--critical-soft)" stroke="var(--critical)" />
                </g>
              </svg>
            </div>
          </div>

          <div className="hidden border-l border-border bg-surface-2 p-2.5 lg:block">
            <p className="text-[7.5px] font-medium uppercase tracking-[0.08em] text-ink-3">Case risk</p>
            <div className="mt-2 flex items-center gap-2">
              <div className="relative size-16">
                <svg viewBox="0 0 64 64" className="-rotate-90" aria-hidden>
                  <circle cx="32" cy="32" r="27" fill="none" stroke="var(--surface-3)" strokeWidth="5" />
                  <circle cx="32" cy="32" r="27" fill="none" stroke="var(--high)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 27 * 0.87} ${2 * Math.PI * 27}`} />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] font-medium text-ink">0.87</span>
              </div>
              <div>
                <p className="text-[8.5px] font-medium text-high">High risk</p>
                <p className="text-[7px] text-ink-3">threshold 0.70</p>
              </div>
            </div>
            <div className="mt-3 border-t border-border pt-2">
              <p className="text-[7.5px] font-medium uppercase tracking-[0.08em] text-ink-3">Strongest driver</p>
              <p className="mt-1 text-[8px] text-ink-2">Shared device</p>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-3">
                <div className="h-full w-[92%] rounded-full bg-critical" />
              </div>
              <p className="mt-1 font-mono text-[7px] text-ink-3">+0.262 · 4 accounts</p>
            </div>
            <div className="mt-3 border-t border-border pt-2">
              <p className="text-[7.5px] font-medium uppercase tracking-[0.08em] text-ink-3">Chain state</p>
              <div className="mt-1 space-y-1">
                {["intake_note.txt", "txn_export.csv", "device_session.png"].map((file) => (
                  <div key={file} className="flex items-center gap-1">
                    <CheckCircle2 className="size-2.5 text-verified" aria-hidden />
                    <span className="truncate font-mono text-[7px] text-ink-3">{file}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 rounded border border-border bg-surface p-1.5 text-center">
              <span className="font-mono text-[7px] text-ink-3">append-only audit · 14 entries</span>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3">
        Illustrative interface · all identifiers and amounts are synthetic
      </p>
    </div>
  );
}

function Hero() {
  return (
    <section className="hero-mesh relative overflow-hidden border-b border-border">
      <div className="pointer-events-none absolute inset-0 landing-grid" aria-hidden />
      <div className="pointer-events-none absolute left-[8%] top-[10%] size-[340px] rounded-full bg-[var(--hero-glow-1)] opacity-70 blur-3xl motion-safe:animate-drift" aria-hidden />
      <div className="pointer-events-none absolute right-[4%] top-[24%] size-[300px] rounded-full bg-[var(--hero-glow-2)] opacity-60 blur-3xl" aria-hidden />
      <div className="container-page relative pb-14 pt-16 md:pb-20 md:pt-24">
        <div className="mx-auto max-w-[860px] text-center">
          <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/70 px-2.5 py-1 text-[10.5px] font-medium text-ink-2 backdrop-blur-sm">
              <span className="size-1.5 rounded-full bg-accent" aria-hidden />
              Bank-side fraud investigation
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/70 px-2.5 py-1 text-[10.5px] text-ink-3 backdrop-blur-sm">
              Seven stages · one workspace
            </span>
          </div>
          <h1 className="text-display-xl balance font-medium text-ink">
            Follow the money.
            <br />
            <span className="font-serif italic tracking-[-0.02em] text-accent-ink">Keep the proof.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-[620px] text-[15px] leading-7 text-ink-2 md:text-[17px] md:leading-8">
            Fraxillion connects alert triage, explainable risk, money-trail reconstruction, tamper-evident evidence,
            maker-checker decisions and regulatory filing in one bank-side investigation workspace.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/app">
                Proceed to use <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="w-full sm:w-auto">
              <a href="#workflow">Walk the workflow</a>
            </Button>
          </div>
          <p className="mt-4 text-[10.5px] text-ink-3">
            Synthetic sample data · no live bank feed · no real customer information
          </p>
        </div>
        <HeroPreview />
      </div>
    </section>
  );
}

function StageSection() {
  const [active, setActive] = React.useState(0);
  const step = STEPS[active]!;
  const Icon = step.icon;
  return (
    <section id="workflow" className="container-page scroll-mt-20 py-20 md:py-28">
      <div className="max-w-2xl">
        <p className="label-mono mb-3">The workflow</p>
        <h2 className="text-display-lg balance font-medium text-ink">
          Seven stages. <span className="font-serif italic text-accent-ink">No handoff gaps.</span>
        </h2>
        <p className="mt-4 max-w-xl text-[15px] leading-7 text-ink-2">
          The console follows the work the bank already does, in the order it does it. Select a stage to see what the
          product actually enforces.
        </p>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[300px_1fr] lg:gap-14">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <ol className="scrollbar-thin -mx-1 flex gap-1 overflow-x-auto px-1 pb-2 lg:mx-0 lg:block lg:space-y-1 lg:overflow-visible lg:px-0 lg:pb-0" aria-label="Investigation stages">
            {STEPS.map((item, index) => {
              const ItemIcon = item.icon;
              const selected = index === active;
              return (
                <li key={item.id} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => setActive(index)}
                    aria-current={selected ? "step" : undefined}
                    className={cn(
                      "flex w-auto items-center gap-2.5 rounded-md border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-full",
                      selected
                        ? "border-accent/30 bg-accent-soft text-accent-ink"
                        : "border-transparent text-ink-2 hover:border-border hover:bg-surface-2",
                    )}
                  >
                    <span className={cn("flex size-6 shrink-0 items-center justify-center rounded border font-mono text-[9px]", selected ? "border-accent/30 bg-surface text-accent-ink" : "border-border bg-surface-2 text-ink-3")}>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <ItemIcon className={cn("size-3.5 shrink-0", selected ? "text-accent" : "text-ink-3")} aria-hidden />
                    <span className="whitespace-nowrap text-[12.5px] font-medium lg:whitespace-normal">{item.label}</span>
                    <ChevronRight className={cn("ml-auto hidden size-3.5 lg:block", selected ? "text-accent" : "text-ink-3")} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="mt-5 hidden rounded-lg border border-border bg-surface-2 px-3 py-2.5 lg:block">
            <div className="flex items-center gap-1.5 text-[10px] text-ink-3">
              <ShieldCheck className="size-3.5 text-verified" aria-hidden />
              Human decision is always required
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-ink-3">
              No model output, evidence check or draft filing submits itself. A person with the right role acts.
            </p>
          </div>
        </div>

        <div key={step.id} className="animate-[fade-up_260ms_ease-out]">
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm md:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-lg border border-accent/25 bg-accent-soft text-accent-ink">
                <Icon className="size-4" aria-hidden />
              </span>
              <p className="label-mono">{step.kicker}</p>
              <Badge tone="outline" size="sm" className="ml-auto">sample implementation</Badge>
            </div>
            <h3 className="mt-5 text-[24px] font-medium leading-tight tracking-[-0.03em] text-ink md:text-[30px]">{step.title}</h3>
            <p className="mt-3 max-w-2xl text-[14px] leading-7 text-ink-2">{step.body}</p>
            <ul className="mt-5 grid gap-2.5">
              {step.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-ink-2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-verified" aria-hidden />
                  {bullet}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-ink-3">{step.detail}</span>
              <Button asChild variant="ghost" size="sm" className="ml-auto">
                <Link href={step.href}>
                  {step.cta} <ArrowUpRight className="size-3.5" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 px-1">
            <p className="text-[10px] text-ink-3">
              Stage {active + 1} of {STEPS.length}
            </p>
            <div className="flex gap-1">
              {STEPS.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActive(index)}
                  aria-label={`Go to ${item.label}`}
                  aria-current={index === active}
                  className="flex size-6 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={cn(
                      "block h-1.5 rounded-full transition-all",
                      index === active ? "w-4 bg-accent" : "w-1.5 bg-border-strong hover:bg-ink-3",
                    )}
                    aria-hidden
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const CHAIN_STEPS = [
  {
    label: "Seal",
    endpoint: "POST /api/evidence/attach",
    text: "The API copies the bytes into evidence_files/, stores their SHA-256 and appends an item hash over the case, file hash, previous hash and kind.",
  },
  {
    label: "Verify",
    endpoint: "GET /api/evidence/verify",
    text: "Every file is re-hashed from disk and compared with the stored value; the previous-hash pointers are walked in insertion order across all cases.",
  },
  {
    label: "Alter",
    endpoint: "POST /api/evidence/tamper",
    text: "A demonstration endpoint appends bytes to the stored copy and keeps a .demo-original backup. The database hash is never edited.",
  },
  {
    label: "Restore",
    endpoint: "POST /api/evidence/restore",
    text: "The original bytes are copied back from the backup, so a second verification returns to an intact state.",
  },
];

function IntegritySection() {
  return (
    <section id="integrity" className="scroll-mt-20 border-y border-border bg-surface-2 py-20 md:py-28">
      <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-16">
        <div>
          <p className="label-mono mb-3">Evidence integrity</p>
          <h2 className="text-display-lg balance font-medium text-ink">
            When a file changes, <span className="font-serif italic text-accent-ink">say so.</span>
          </h2>
          <p className="mt-4 max-w-lg text-[14.5px] leading-7 text-ink-2">
            A hash chain does not stop tampering. It makes tampering visible. Each evidence item stores a SHA-256 file
            hash and a chain hash over the case, previous hash and kind. Verification walks the chain and names the
            item that fails.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              ["Seal", "SHA-256 of the acquired bytes and an entry in the chain."],
              ["Verify", "Recompute from disk, compare with the stored value, name the failing id."],
              ["Ownership", "The audit log records the actor, action and IST timestamp for each step."],
            ].map(([label = "", text = ""]) => (
              <li key={label} className="flex gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded border border-border bg-surface text-[9px] font-medium text-ink-3">{label.slice(0, 1)}</span>
                <p className="text-[12px] leading-relaxed text-ink-2"><span className="font-medium text-ink">{label}.</span> {text}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5 font-mono text-[9.5px] leading-relaxed text-ink-3">
            genesis = 64 zeros · item_hash = SHA-256(canonical_json({"{case_id, file_hash, prev_hash, kind}"}))
          </p>
          <Button asChild variant="secondary" size="sm" className="mt-6">
            <Link href="/app/evidence">
              Open Evidence <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-surface shadow-md">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
            <Fingerprint className="size-4 text-accent" aria-hidden />
            <h3 className="text-[12px] font-semibold text-ink">What the API actually does</h3>
            <Badge tone="outline" size="sm" className="ml-auto">live endpoints</Badge>
          </div>
          <ol className="divide-y divide-border">
            {CHAIN_STEPS.map((step, index) => (
              <li key={step.label} className="flex items-start gap-3 px-4 py-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded border border-border bg-surface-2 font-mono text-[8.5px] text-ink-3">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[12px] font-medium text-ink">{step.label}</p>
                    <span className="font-mono text-[9px] text-ink-3">{step.endpoint}</span>
                  </div>
                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-ink-3">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="border-t border-border px-4 py-3">
            <p className="text-[10px] leading-relaxed text-ink-3">
              The console calls these endpoints directly. Attach the sample note, run Verify, alter the file, run
              Verify again and restore it from the Evidence segment once a case exists.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Bento() {
  return (
    <section id="product" className="container-page scroll-mt-20 py-20 md:py-28">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <p className="label-mono mb-3">The product</p>
          <h2 className="text-display-lg balance font-medium text-ink">
            Built for the questions <span className="font-serif italic text-accent-ink">after the alert.</span>
          </h2>
          <p className="mt-4 text-[14.5px] leading-7 text-ink-2">
            The alert is the beginning. The real work is correlation, explanation, evidence, review and a filing that
            can survive a challenge.
          </p>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href="/app">Open the console <ArrowRight className="size-3.5" /></Link>
        </Button>
      </div>

      <div className="mt-10 grid gap-3 md:grid-cols-6">
        <article className="flex h-full flex-col rounded-xl border border-border bg-surface p-5 shadow-sm md:col-span-4">
          <div className="flex items-center justify-between gap-3">
            <span className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface-2 text-ink-3"><BrainCircuit className="size-4" aria-hidden /></span>
            <Badge tone="outline" size="sm">explainable</Badge>
          </div>
          <h3 className="mt-4 text-[16px] font-semibold tracking-[-0.02em] text-ink">A score that shows its work.</h3>
          <p className="mt-1.5 max-w-xl text-[12px] leading-relaxed text-ink-3">
            Per-case feature attribution, a threshold you can move, and evaluation metrics with the synthetic-data
            caveat still attached. The score is advisory; a person decides.
          </p>
          <div className="mt-4 space-y-2 rounded-lg border border-border bg-surface-2 p-3">
            {[
              ["Shared device", "+0.262", 88, "critical"],
              ["Night window", "+0.192", 64, "high"],
              ["First-time beneficiary", "+0.084", 32, "medium"],
              ["Round amount", "−0.011", 9, "verified"],
            ].map(([label, value, width, tone]) => (
              <div key={String(label)} className="flex items-center gap-2">
                <span className="w-32 shrink-0 text-[9.5px] text-ink-3">{label}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <div className={cn("h-full rounded-full", tone === "critical" ? "bg-critical" : tone === "high" ? "bg-high" : tone === "medium" ? "bg-medium" : "bg-verified")} style={{ width: `${width}%` }} />
                </div>
                <span className="w-12 shrink-0 text-right font-mono text-[9px] text-ink-2">{value}</span>
              </div>
            ))}
          </div>
          <p className="mt-auto pt-4 font-mono text-[9px] uppercase tracking-[0.08em] text-ink-3">
            Threshold 0.70 · RandomForest rf-2026.11 · advisory output
          </p>
        </article>

        <article className="rounded-xl border border-border bg-surface p-5 shadow-sm md:col-span-2">
          <span className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface-2 text-ink-3"><Network className="size-4" aria-hidden /></span>
          <h3 className="mt-4 text-[16px] font-semibold tracking-[-0.02em] text-ink">The trail, not a hairball.</h3>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-3">
            Directed transfers and shared-device links are never conflated. Path finding answers “how did value get
            here?”
          </p>
          <svg viewBox="0 0 180 100" className="mt-4 w-full" role="img" aria-label="Illustrative directed graph">
            <g stroke="var(--graph-edge-active)" strokeWidth="1" fill="none" markerEnd="url(#arrow)">
              <defs>
                <marker id="arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                  <path d="M0 0 5 2.5 0 5z" fill="var(--graph-edge-active)" />
                </marker>
              </defs>
              <path d="M34 50 82 26M34 50 82 72M82 26 136 36M82 72 136 62" />
              <path d="M82 26 136 36M82 72 136 62" />
            </g>
            <g>
              <circle cx="34" cy="50" r="11" fill="var(--graph-focus)" />
              <circle cx="82" cy="26" r="8" fill="var(--graph-node)" stroke="var(--graph-edge)" />
              <circle cx="82" cy="72" r="8" fill="var(--graph-node)" stroke="var(--graph-edge)" />
              <circle cx="136" cy="36" r="7" fill="var(--critical-soft)" stroke="var(--critical)" />
              <circle cx="136" cy="62" r="7" fill="var(--critical-soft)" stroke="var(--critical)" />
            </g>
          </svg>
        </article>

        <article className="rounded-xl border border-border bg-surface p-5 shadow-sm md:col-span-2">
          <span className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface-2 text-ink-3"><Fingerprint className="size-4" aria-hidden /></span>
          <h3 className="mt-4 text-[16px] font-semibold tracking-[-0.02em] text-ink">Evidence that can prove itself.</h3>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-3">
            SHA-256 file hashes, a chained item hash and a named failure when the bytes change.
          </p>
          <div className="mt-4 space-y-1.5">
            {["8f2c 91a4 0d77 e1b3", "1b6d 4af0 92c8 55e1", "c4e8 7021 bb63 9df2"].map((hash) => (
              <div key={hash} className="flex items-center gap-1.5 rounded border border-border bg-surface-2 px-2 py-1.5">
                <CheckCircle2 className="size-3 text-verified" aria-hidden />
                <span className="font-mono text-[8.5px] text-ink-3">{hash} …</span>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-border bg-surface p-5 shadow-sm md:col-span-2">
          <span className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface-2 text-ink-3"><Scale className="size-4" aria-hidden /></span>
          <h3 className="mt-4 text-[16px] font-semibold tracking-[-0.02em] text-ink">Two names before anything moves.</h3>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-3">
            Maker-checker is enforced by identity. The approver cannot be the person who proposed the decision.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 rounded border border-border bg-surface-2 px-2 py-1.5">
              <p className="text-[8px] uppercase tracking-[0.06em] text-ink-3">maker</p>
              <p className="font-mono text-[9px] text-ink-2">A. Sharma</p>
            </div>
            <ArrowRight className="size-3 text-ink-3" aria-hidden />
            <div className="flex-1 rounded border border-border bg-surface-2 px-2 py-1.5">
              <p className="text-[8px] uppercase tracking-[0.06em] text-ink-3">checker</p>
              <p className="font-mono text-[9px] text-ink-2">P. Krishnan</p>
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-border bg-surface p-5 shadow-sm md:col-span-2">
          <span className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface-2 text-ink-3"><Terminal className="size-4" aria-hidden /></span>
          <h3 className="mt-4 text-[16px] font-semibold tracking-[-0.02em] text-ink">Keyboard first.</h3>
          <p className="mt-1.5 text-[12px] leading-relaxed text-ink-3">
            Global search, command palette, sortable tables and focus-visible controls throughout the console.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <span className="flex h-8 flex-1 items-center gap-2 rounded border border-border bg-surface-2 px-2 text-[9.5px] text-ink-3"><span className="size-2 rounded-full border border-border-strong" aria-hidden />Search cases, accounts, hashes…</span>
            <Kbd><Command className="size-2.5" /></Kbd><Kbd>K</Kbd>
          </div>
        </article>

        <article className="rounded-xl border border-border bg-surface p-5 shadow-sm md:col-span-4">
          <div className="flex flex-wrap items-start gap-4">
            <span className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface-2 text-ink-3"><Landmark className="size-4" aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-ink">Built for Indian operations.</h3>
              <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-ink-3">
                Rupee amounts with lakh and crore grouping, IST made explicit on every timestamp, DD MMM YYYY dates,
                masked account identifiers and an explicit reveal action.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-right">
              <span className="font-mono text-[11px] text-ink">₹12,46,836.60</span>
              <span className="font-mono text-[11px] text-ink">13 Nov 2026</span>
              <span className="font-mono text-[10px] text-ink-3">lakh / crore grouping</span>
              <span className="font-mono text-[10px] text-ink-3">17:42 IST</span>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

function ModelStrip() {
  const metrics = [
    ["ROC-AUC", "0.9956"],
    ["PR-AUC", "0.9147"],
    ["Recall", "0.9076"],
    ["Precision", "0.4876"],
  ];
  return (
    <section className="border-y border-border bg-surface-2">
      <div className="container-page grid gap-6 py-10 md:grid-cols-[1fr_1.4fr] md:items-center">
        <div>
          <p className="label-mono mb-2">Evaluation, with caveats</p>
          <h2 className="text-[22px] font-medium tracking-[-0.03em] text-ink">Measured on a synthetic corpus.</h2>
          <p className="mt-2 max-w-md text-[11.5px] leading-relaxed text-ink-3">
            These values come from the repository&apos;s evaluation split, not from a production deployment. Precision
            is low at a 2% base rate; review capacity matters more than accuracy.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
          {metrics.map(([label, value]) => (
            <div key={label} className="bg-surface px-4 py-4">
              <dt className="text-[9px] font-medium uppercase tracking-[0.08em] text-ink-3">{label}</dt>
              <dd className="mt-1 font-mono text-[22px] font-medium tabular-nums tracking-[-0.03em] text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Boundaries() {
  return (
    <section id="boundaries" className="scroll-mt-20 bg-[var(--band-bg)] py-20 text-[var(--band-fg)] md:py-28">
      <div className="container-page grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-20">
        <div>
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.1em] opacity-70">Boundaries</p>
          <h2 className="text-display-lg balance font-medium">
            What this demo <span className="font-serif italic">does not</span> claim.
          </h2>
          <p className="mt-5 max-w-lg text-[14px] leading-7 opacity-80">
            Trust in an investigation tool comes from being precise about its limits. This build is a frontend
            showcase with synthetic data and a thin API boundary. It is not a compliance certification, a production
            deployment or a filing system.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-7 border-transparent bg-[var(--band-fg)] text-[var(--band-bg)] hover:bg-[var(--band-fg)]/90">
            <Link href="/app">Proceed to use <ArrowRight className="size-4" /></Link>
          </Button>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            ["No live bank feed", "Every account, transaction and alert is generated. No production core-banking connection exists."],
            ["No real customer data", "Identifiers are synthetic and masked. Revealing an account records a demo action only."],
            ["No regulator transmission", "PFR and STR previews are text artifacts. Nothing is sent to FIU-IND, RBI DAKSH or any other body."],
            ["No FMR invention", "The repository has no FMR renderer or field specification. The screen says TODO(compliance) rather than guessing."],
            ["No compliance claim", "The product does not assert that its fields, validations or workflow satisfy any regulation."],
            ["No autonomous decision", "A model score, graph motif or evidence pass never files or closes a case by itself."],
          ].map(([title, body]) => (
            <li key={title} className="rounded-lg border border-[var(--band-line)] bg-[var(--band-fill)] p-4">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold"><CircleAlert className="size-3.5 shrink-0" aria-hidden /> {title}</p>
              <p className="mt-1.5 text-[10.5px] leading-relaxed opacity-80">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="container-page py-20 md:py-28">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-8 shadow-md md:p-14">
        <div className="pointer-events-none absolute inset-0 hero-mesh opacity-60" aria-hidden />
        <div className="relative mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-5 flex size-11 items-center justify-center rounded-xl border border-accent/25 bg-accent-soft text-accent-ink">
            <Waypoints className="size-5" aria-hidden />
          </div>
          <p className="label-mono mb-3">Ready when you are</p>
          <h2 className="text-display-md balance font-medium text-ink">
            Open the console and <span className="font-serif italic text-accent-ink">follow a case.</span>
          </h2>
          <p className="mt-4 text-[13.5px] leading-7 text-ink-2">
            The console opens empty. Load the synthetic corpus when you are ready, then work the seven stages from
            ingest to filing. No signup, no live data, no regulator connection.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="xl" className="w-full sm:w-auto">
              <Link href="/app">Proceed to use <ArrowRight className="size-4" /></Link>
            </Button>
            <Button asChild size="xl" variant="secondary" className="w-full sm:w-auto">
              <a href="#workflow">Walk the workflow</a>
            </Button>
          </div>
          <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.09em] text-ink-3">
            synthetic data · light / dark · keyboard accessible
          </p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-surface-2">
      <div className="container-page grid gap-8 py-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-sm text-[11px] leading-relaxed text-ink-3">
            A bank-side investigation workspace for alert triage, correlation, explainable risk, money trails,
            evidence integrity, decisions and reporting.
          </p>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-medium/25 bg-medium-soft px-2 py-1 text-[9px] font-medium text-medium">
            <CircleAlert className="size-3" aria-hidden /> Synthetic demonstration
          </p>
        </div>
        <div>
          <p className="label-mono mb-2">Console</p>
          <ul className="space-y-1.5 text-[11.5px] text-ink-2">
            <li><Link href="/app" className="hover:text-ink hover:underline underline-offset-2">Overview</Link></li>
            <li><Link href="/app/ingest" className="hover:text-ink hover:underline underline-offset-2">Ingest &amp; alert queue</Link></li>
            <li><Link href="/app/cases" className="hover:text-ink hover:underline underline-offset-2">Case queue</Link></li>
            <li><Link href="/app/evidence" className="hover:text-ink hover:underline underline-offset-2">Evidence chain</Link></li>
            <li><Link href="/app/reports" className="hover:text-ink hover:underline underline-offset-2">Reports</Link></li>
          </ul>
        </div>
        <div>
          <p className="label-mono mb-2">Reference</p>
          <ul className="space-y-1.5 text-[11.5px] text-ink-2">
            <li><a href="#workflow" className="hover:text-ink hover:underline underline-offset-2">Workflow</a></li>
            <li><a href="#integrity" className="hover:text-ink hover:underline underline-offset-2">Evidence integrity</a></li>
            <li><a href="#product" className="hover:text-ink hover:underline underline-offset-2">Product</a></li>
            <li><Link href="/app/audit" className="hover:text-ink hover:underline underline-offset-2">Audit log</Link></li>
          </ul>
        </div>
      </div>
      <div className="container-page flex flex-col gap-2 border-t border-border py-4 text-[9.5px] text-ink-3 sm:flex-row sm:items-center sm:justify-between">
        <span>Fraxillion v2 · frontend demonstration · not affiliated with Stripe or any regulator.</span>
        <span className="font-mono uppercase tracking-[0.08em]">Light default · dark persisted · WCAG 2.2 AA target</span>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-bg">
      <LandingNav />
      <main id="main">
        <Hero />
        <div className="border-b border-border bg-surface-2">
          <div className="container-page flex flex-wrap items-center justify-center gap-x-8 gap-y-3 py-5 text-center">
            <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-ink-3">Seven stages, already familiar</span>
            {["Ingest", "Correlate", "Score", "Trace", "Seal", "Decide", "File"].map((label, index) => (
              <React.Fragment key={label}>
                {index > 0 ? <span className="hidden size-1 rounded-full bg-border-strong sm:block" aria-hidden /> : null}
                <span className="text-[11.5px] font-medium text-ink-2">{label}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
        <StageSection />
        <IntegritySection />
        <Bento />
        <ModelStrip />
        <Boundaries />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
