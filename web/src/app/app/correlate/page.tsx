"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  GitBranch,
  Info,
  Loader2,
  Play,
  ShieldAlert,
  Waypoints,
} from "lucide-react";
import type { Candidate } from "@/types";
import {
  useAcceptCandidate,
  useAlerts,
  useCorrelation,
  useRunCorrelation,
} from "@/lib/queries";
import { useSessionStore } from "@/stores";
import { formatDateTimeIST, formatINRCompact, formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/console/page-header";
import { Badge, SeverityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import {
  Callout,
  EmptyState,
  ErrorState,
  LoadingState,
  Metric,
  Panel,
  PanelHeader,
} from "@/components/ui/misc";

function CandidateCard({ candidate, actor }: { candidate: Candidate; actor: string }) {
  const accept = useAcceptCandidate();
  const accepted = candidate.acceptedCaseId;

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12px] font-medium text-ink">{candidate.id}</span>
            <SeverityBadge severity={candidate.highestSeverity} showIcon={false} />
            <Badge tone="outline" size="sm">
              {formatNumber(candidate.alertCount)} alert{candidate.alertCount === 1 ? "" : "s"}
            </Badge>
            {accepted ? (
              <Badge tone="verified" size="sm">
                <CheckCircle2 className="size-3" /> {accepted}
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-[11.5px] text-ink-2">
            {formatINRCompact(candidate.totalAmount)} · {candidate.distinctBeneficiaries} distinct
            beneficiaries
          </p>
          <p className="mt-1 text-[10.5px] text-ink-3">
            Shared keys:{" "}
            <span className="font-mono text-ink-2">
              {candidate.sharedKeys.length ? candidate.sharedKeys.join(", ") : "none"}
            </span>
          </p>
          <p className="mt-0.5 truncate font-mono text-[10px] text-ink-3">
            {candidate.alerts.slice(0, 8).join(" · ")}
            {candidate.alerts.length > 8 ? ` · +${candidate.alerts.length - 8}` : ""}
          </p>
        </div>
        {accepted ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/app/cases/${accepted}`}>
              Open case <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={accept.isPending}
            onClick={() => accept.mutate({ candidateId: candidate.id, actor })}
          >
            {accept.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
            Accept as case
          </Button>
        )}
      </div>
    </li>
  );
}

export default function CorrelatePage() {
  const actor = useSessionStore((s) => s.actor);
  const alerts = useAlerts({ limit: 1 });
  const { data, isLoading, isError, refetch } = useCorrelation();
  const run = useRunCorrelation();
  const [hubThreshold, setHubThreshold] = React.useState(20);
  const [maxCaseSize, setMaxCaseSize] = React.useState(30);

  const totalAlerts = alerts.data?.total ?? 0;

  return (
    <div className="space-y-3">
      <PageHeader
        eyebrow={<Badge tone="outline" size="sm">segment 02</Badge>}
        title="Correlate"
        description="Group alerts that share an account, device or beneficiary. The core suppresses merchant-like hubs above the threshold and refuses clusters larger than the case cap; you accept a candidate to turn it into a real case."
        actions={
          <Button
            size="sm"
            onClick={() => run.mutate({ hubThreshold, maxCaseSize })}
            disabled={run.isPending || totalAlerts === 0}
          >
            {run.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
            {run.isPending ? "Correlating…" : "Run correlation"}
          </Button>
        }
      />

      {totalAlerts === 0 ? (
        <Panel>
          <EmptyState
            icon={GitBranch}
            title="No alerts to correlate"
            description="Ingest the alert feed first. Correlation reads every alert row and never fabricates candidates."
            action={
              <Button asChild size="sm">
                <Link href="/app/ingest">Open Ingest</Link>
              </Button>
            }
          />
        </Panel>
      ) : (
        <>
          <Panel>
            <PanelHeader
              title="Run parameters"
              description="These map to core.correlate.correlate_alerts."
              actions={
                <Badge tone="outline" size="sm">
                  {formatNumber(totalAlerts)} alerts available
                </Badge>
              }
            />
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[220px_220px_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor="hub">Hub threshold</Label>
                <Input
                  id="hub"
                  type="number"
                  min={1}
                  max={100}
                  value={hubThreshold}
                  onChange={(e) => setHubThreshold(Number(e.target.value))}
                />
                <p className="text-[10px] text-ink-3">Keys appearing on more alerts than this are treated as hubs.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="size">Max case size</Label>
                <Input
                  id="size"
                  type="number"
                  min={2}
                  max={200}
                  value={maxCaseSize}
                  onChange={(e) => setMaxCaseSize(Number(e.target.value))}
                />
                <p className="text-[10px] text-ink-3">Clusters above this are skipped, not truncated.</p>
              </div>
              <div className="flex items-end">
                <p className="text-[10.5px] leading-relaxed text-ink-3">
                  Accepting a candidate calls core.workflow.create_case and writes the case, its alert
                  links and an audit entry.
                </p>
              </div>
            </div>
          </Panel>

          {isLoading ? (
            <LoadingState rows={4} />
          ) : isError || !data ? (
            <ErrorState title="Correlation state unavailable" onRetry={() => refetch()} />
          ) : !data.runAt ? (
            <Callout tone="neutral" title="No run in this session">
              Configure the parameters and run correlation. The result is held in memory until the server
              restarts; accepted cases are persisted in SQLite.
            </Callout>
          ) : (
            <>
              <Panel className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
                <div className="px-4 py-3"><Metric label="Candidates" value={formatNumber(data.candidates.length)} /></div>
                <div className="px-4 py-3"><Metric label="Alerts considered" value={formatNumber(data.alertsConsidered)} /></div>
                <div className="px-4 py-3"><Metric label="Hubs suppressed" value={formatNumber(data.droppedHubs.length)} /></div>
                <div className="px-4 py-3"><Metric label="Oversized skipped" value={formatNumber(data.skippedOversized.length)} /></div>
              </Panel>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-ink-3">
                <span>Run at {formatDateTimeIST(data.runAt)}</span>
                <span>hub threshold {data.parameters.hubThreshold}</span>
                <span>max case size {data.parameters.maxCaseSize}</span>
              </div>

              <Panel>
                <PanelHeader
                  title="Candidate cases"
                  description="Accepting a candidate persists it; the remaining candidates are recomputed on the next run."
                  actions={
                    <Badge tone={data.candidates.length ? "accent" : "neutral"} size="sm">
                      {data.candidates.length} candidate{data.candidates.length === 1 ? "" : "s"}
                    </Badge>
                  }
                />
                {data.candidates.length === 0 ? (
                  <EmptyState
                    icon={Waypoints}
                    title="No candidates at these thresholds"
                    description="All alert groups were either hubs or oversized. Raise the hub threshold or resets the dataset and retry."
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {data.candidates.map((candidate) => (
                      <CandidateCard key={candidate.id} candidate={candidate} actor={actor} />
                    ))}
                  </ul>
                )}
              </Panel>

              {(data.droppedHubs.length > 0 || data.skippedOversized.length > 0) && (
                <div className="grid gap-3 lg:grid-cols-2">
                  {data.droppedHubs.length > 0 ? (
                    <Panel>
                      <PanelHeader title="Suppressed hubs" description="Keys above the hub threshold" />
                      <ul className="divide-y divide-border">
                        {data.droppedHubs.map((hub) => (
                          <li key={hub.key} className="px-4 py-2.5 text-[11px]">
                            <div className="flex items-center gap-2">
                              <ShieldAlert className="size-3.5 text-medium" aria-hidden />
                              <span className="font-mono text-ink-2">{hub.key}</span>
                              <span className="ml-auto font-mono text-[10px] text-ink-3">
                                {hub.alertCount} alerts
                              </span>
                            </div>
                            <p className="mt-0.5 text-[10.5px] text-ink-3">{hub.reason}</p>
                          </li>
                        ))}
                      </ul>
                    </Panel>
                  ) : null}
                  {data.skippedOversized.length > 0 ? (
                    <Panel>
                      <PanelHeader title="Oversized clusters" description="Skipped above the case cap" />
                      <ul className="divide-y divide-border">
                        {data.skippedOversized.map((item, index) => (
                          <li key={`${item.size}-${index}`} className="flex items-start gap-2 px-4 py-2.5 text-[11px]">
                            <Info className="mt-0.5 size-3.5 shrink-0 text-ink-3" aria-hidden />
                            <div>
                              <p className="font-mono text-ink-2">{item.size} alerts</p>
                              <p className="text-[10.5px] text-ink-3">{item.reason}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </Panel>
                  ) : null}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
