"use client";

import Link from "next/link";
import {
  ArrowRight,
  Database,
  FileSearch,
  FileText,
  Fingerprint,
  GitBranch,
  Scale,
  Siren,
} from "lucide-react";
import { useOverview } from "@/lib/queries";
import {
  formatDateTimeIST,
  formatINRCompact,
  formatNumber,
  formatRelative,
} from "@/lib/utils";
import { PageHeader } from "@/components/console/page-header";
import { Badge, SeverityBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState, Metric, Panel, PanelHeader } from "@/components/ui/misc";

const SEGMENT_GUIDE = [
  { href: "/app/ingest", label: "Ingest", text: "Load and validate transactions and alerts." },
  { href: "/app/correlate", label: "Correlate", text: "Cluster alerts and accept a candidate case." },
  { href: "/app/score", label: "ML Score", text: "Read the case probability and its drivers." },
  { href: "/app/graph", label: "Graph", text: "Trace the money trail and typologies." },
  { href: "/app/cases", label: "Cases", text: "Work the case, record and approve a decision." },
  { href: "/app/evidence", label: "Evidence", text: "Seal artifacts into the hash chain and verify." },
  { href: "/app/reports", label: "Reports", text: "Preview and register the PFR or STR." },
];

export default function OverviewPage() {
  const { data, isLoading, isError, refetch } = useOverview();

  if (isLoading) return <LoadingState title="Loading overview" rows={6} />;
  if (isError || !data) return <ErrorState title="Overview unavailable" onRetry={() => refetch()} />;

  if (!data.loaded) {
    return (
      <div>
        <PageHeader
          eyebrow={<Badge tone="outline" size="sm">empty database</Badge>}
          title="Investigation overview"
          description="This console reads directly from fraxillion.db. Nothing is preloaded: the workflow starts when you load the synthetic corpus."
        />
        <Panel>
          <EmptyState
            icon={Database}
            title="No dataset loaded"
            description="Use Load sample data in the next-step bar above, then walk the seven segments in order. Correlate creates the first case; nothing is invented here."
          />
          <ol className="grid gap-px border-t border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {SEGMENT_GUIDE.map((item, index) => (
              <li key={item.href} className="bg-surface px-4 py-3">
                <Link href={item.href} className="group block focus-visible:outline-none">
                  <span className="font-mono text-[10px] text-ink-3">{String(index + 1).padStart(2, "0")}</span>
                  <p className="mt-0.5 text-[12px] font-medium text-ink-2 group-hover:text-ink">{item.label}</p>
                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-ink-3">{item.text}</p>
                </Link>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    );
  }

  const counts = data.counts;
  const metrics = [
    { label: "Transactions", value: formatNumber(counts.transactions), sub: "parsed and stored", icon: Database },
    { label: "Alerts", value: formatNumber(counts.alerts), sub: `${formatNumber(data.unlinkedAlerts)} unlinked`, icon: Siren },
    { label: "Cases", value: formatNumber(counts.cases), sub: `${data.pendingDecisions} pending decision(s)`, icon: FileSearch },
    { label: "Evidence", value: formatNumber(counts.evidence), sub: "hash-chain links", icon: Fingerprint },
    { label: "Decisions", value: formatNumber(counts.decisions), sub: "maker-checker records", icon: Scale },
    { label: "Reports", value: formatNumber(counts.reports), sub: "registered filings", icon: FileText },
  ];

  return (
    <div className="space-y-3">
      <PageHeader
        eyebrow={<Badge tone="verified" size="sm">live SQLite</Badge>}
        title="Investigation overview"
        description="Every figure below is a count from fraxillion.db. Start at the next-step bar above; each segment only shows what that step needs."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/app/cases">
              <FileSearch className="size-3.5" /> Open cases
            </Link>
          </Button>
        }
        meta={
          <span className="text-[11px] text-ink-3">
            {counts.alerts > 0
              ? `${formatNumber(data.unlinkedAlerts)} alerts are not yet assigned to a case`
              : "No alerts ingested yet"}
          </span>
        }
      />

      <Panel className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="px-4 py-3.5">
              <div className="flex items-center gap-1.5 text-ink-3">
                <Icon className="size-3.5" aria-hidden />
                <span className="text-[10px] font-medium uppercase tracking-[0.08em]">{metric.label}</span>
              </div>
              <p className="mt-2 font-mono text-[24px] font-medium leading-none tracking-[-0.04em] tabular-nums text-ink">
                {metric.value}
              </p>
              <p className="mt-1 text-[10.5px] text-ink-3">{metric.sub}</p>
            </div>
          );
        })}
      </Panel>

      <div className="grid items-start gap-3 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-8">
          <Panel>
            <PanelHeader
              title="Cases"
              description="Most recent cases created by accepting a correlation candidate"
              actions={
                <Button asChild variant="outline" size="xs">
                  <Link href="/app/cases">
                    All cases <ArrowRight className="size-3" />
                  </Link>
                </Button>
              }
            />
            {data.recentCases.length === 0 ? (
              <EmptyState
                icon={GitBranch}
                title="No cases yet"
                description="Run correlation and accept a candidate to create the first case."
                action={
                  <Button asChild size="sm">
                    <Link href="/app/correlate">Open Correlate</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {data.recentCases.map((c) => (
                  <li key={c.caseId}>
                    <Link
                      href={`/app/cases/${c.caseId}`}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] text-ink-2">{c.caseId}</span>
                          <StatusBadge status={c.status} />
                          <SeverityBadge severity={c.severity} showIcon={false} />
                        </div>
                        <p className="mt-0.5 truncate text-[11.5px] text-ink-2">{c.title}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-ink-3">
                          {formatINRCompact(c.amount)} · {c.alertCount} alerts · {c.evidenceCount} evidence ·{" "}
                          {formatRelative(c.createdAt)}
                        </p>
                      </div>
                      <ArrowRight className="size-3.5 shrink-0 text-ink-3" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel>
              <PanelHeader
                title="Decisions"
                description="Maker-checker records, newest first"
                actions={
                  <Badge tone={data.pendingDecisions ? "pending" : "neutral"} size="sm">
                    {data.pendingDecisions} pending
                  </Badge>
                }
              />
              {data.recentDecisions.length === 0 ? (
                <EmptyState title="No decisions recorded" description="Propose one from a case in INVESTIGATING." />
              ) : (
                <ul className="divide-y divide-border">
                  {data.recentDecisions.map((d) => (
                    <li key={d.id} className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-ink-3">#{d.id}</span>
                        <span className="font-mono text-[10.5px] text-ink-2">{d.caseId}</span>
                        <StatusBadge status={d.status} className="ml-auto" />
                      </div>
                      <p className="mt-0.5 text-[11.5px] text-ink-2">
                        {d.decisionType.replaceAll("_", " ").toLowerCase()} · {d.grounds.replaceAll("_", " ")}
                      </p>
                      <p className="mt-0.5 font-mono text-[9.5px] text-ink-3">
                        maker {d.maker} · checker {d.checker ?? "pending"}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel>
              <PanelHeader title="Audit trail" description="Newest five entries" />
              {data.recentAudit.length === 0 ? (
                <EmptyState title="No audit entries" description="Actions are recorded as soon as you work the dataset." />
              ) : (
                <ul className="divide-y divide-border">
                  {data.recentAudit.map((entry) => (
                    <li key={entry.id} className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-ink-2">{entry.action}</span>
                        <span className="ml-auto font-mono text-[9.5px] text-ink-3">
                          {formatRelative(entry.createdAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-ink-3">
                        {entry.actor} · {entry.objectType} {entry.objectId}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>

        <div className="space-y-3 xl:col-span-4">
          <Panel>
            <PanelHeader title="Alert severity" description="All ingested alerts" />
            <div className="space-y-2 px-4 py-3">
              {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((sev) => {
                const value = data.alertSeverities[sev] ?? 0;
                const total = counts.alerts || 1;
                return (
                  <div key={sev}>
                    <div className="flex items-center justify-between text-[11px]">
                      <SeverityBadge severity={sev} showIcon={false} />
                      <span className="font-mono tabular-nums text-ink-2">{formatNumber(value)}</span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-3">
                      <div
                        className="h-full rounded-full bg-current"
                        style={{ width: `${(value / total) * 100}%`, color: `var(--${sev.toLowerCase()})` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Case status" description="Across every case" />
            <ul className="divide-y divide-border">
              {Object.keys(data.caseStatuses).length === 0 ? (
                <li className="px-4 py-3 text-[11px] text-ink-3">No cases yet.</li>
              ) : (
                Object.entries(data.caseStatuses).map(([status, value]) => (
                  <li key={status} className="flex items-center gap-2 px-4 py-2">
                    <StatusBadge status={status} />
                    <span className="ml-auto font-mono text-[11px] tabular-nums text-ink-2">{value}</span>
                  </li>
                ))
              )}
            </ul>
          </Panel>

          <Panel>
            <PanelHeader
              title="Latest alerts"
              description="Newest rows in the alert table"
              actions={
                <Button asChild variant="ghost" size="xs">
                  <Link href="/app/ingest">Queue</Link>
                </Button>
              }
            />
            {data.recentAlerts.length === 0 ? (
              <p className="px-4 py-3 text-[11px] text-ink-3">No alerts ingested.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.recentAlerts.map((alert) => (
                  <li key={alert.alertId} className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10.5px] text-ink">{alert.alertId}</span>
                      <SeverityBadge severity={alert.severity} showIcon={false} />
                      <span className="ml-auto font-mono text-[9.5px] text-ink-3">{formatRelative(alert.ts)}</span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-ink-2">{alert.rule}</p>
                    <p className="mt-0.5 font-mono text-[9.5px] text-ink-3">
                      {alert.accountId} · score {alert.score.toFixed(2)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel className="px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-ink-3">Database</p>
            <p className="mt-1 text-[11px] text-ink-2">
              {formatNumber(counts.auditEntries)} audit entries. Last action{" "}
              {data.recentAudit[0] ? formatDateTimeIST(data.recentAudit[0].createdAt) : "—"}.
            </p>
            <Metric label="Pending decisions" value={data.pendingDecisions} className="mt-2" />
          </Panel>
        </div>
      </div>
    </div>
  );
}
