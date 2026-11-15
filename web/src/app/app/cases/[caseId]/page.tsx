"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  Fingerprint,
  Gauge,
  GitBranch,
  Loader2,
  Lock,
  Network,
  Scale,
  ShieldCheck,
  Siren,
  X,
} from "lucide-react";
import type {
  Alert,
  CaseStatus,
  Decision,
  DecisionType,
  Transaction,
} from "@/types";
import {
  useApproveDecision,
  useCase,
  useFileCase,
  useProposeDecision,
  useRejectDecision,
  useRisk,
  useTransitionCase,
} from "@/lib/queries";
import { useSessionStore } from "@/stores";
import { api } from "@/lib/api";
import { stageHref } from "@/lib/case-links";
import {
  DECISION_TYPES,
  formatDateIST,
  formatDateTimeIST,
  formatINR,
  formatINRCompact,
  formatNumber,
  GROUNDS_OPTIONS,
} from "@/lib/utils";
import { PageHeader } from "@/components/console/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Badge, SeverityBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, SimpleSelect, Textarea } from "@/components/ui/field";
import { HashValue, RiskDial } from "@/components/ui/data-display";
import {
  Callout,
  ErrorState,
  LoadingState,
  Metric,
  Panel,
  PanelHeader,
} from "@/components/ui/misc";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/overlays";

const ALERT_COLUMNS: ColumnDef<Alert>[] = [
  {
    accessorKey: "alertId",
    header: "Alert",
    cell: ({ row }) => <span className="font-mono text-[11px] text-ink">{row.original.alertId}</span>,
  },
  {
    accessorKey: "severity",
    header: "Severity",
    cell: ({ row }) => <SeverityBadge severity={row.original.severity} showIcon={false} />,
  },
  { accessorKey: "rule", header: "Rule", cell: ({ row }) => <span className="text-ink-2">{row.original.rule}</span> },
  {
    accessorKey: "accountId",
    header: "Account",
    cell: ({ row }) => <span className="font-mono text-[10.5px] text-ink-2">{row.original.accountId}</span>,
  },
  {
    accessorKey: "score",
    header: "Score",
    cell: ({ row }) => <span className="font-mono tabular-nums text-ink-2">{row.original.score.toFixed(2)}</span>,
  },
  {
    accessorKey: "ts",
    header: "Raised",
    cell: ({ row }) => <span className="whitespace-nowrap text-[10.5px] text-ink-3">{formatDateTimeIST(row.original.ts)}</span>,
  },
];

const TXN_COLUMNS: ColumnDef<Transaction>[] = [
  {
    accessorKey: "txnId",
    header: "Txn",
    cell: ({ row }) => <span className="font-mono text-[11px] text-ink">{row.original.txnId}</span>,
  },
  {
    accessorKey: "ts",
    header: "Time",
    cell: ({ row }) => <span className="whitespace-nowrap text-[10.5px] text-ink-3">{formatDateTimeIST(row.original.ts)}</span>,
  },
  {
    accessorKey: "fromAccount",
    header: "From",
    cell: ({ row }) => <span className="font-mono text-[10.5px] text-ink-2">{row.original.fromAccount}</span>,
  },
  {
    accessorKey: "toAccount",
    header: "To",
    cell: ({ row }) => (
      <span className="font-mono text-[10.5px] text-ink-2">{row.original.toAccount || row.original.toVpa}</span>
    ),
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => <span className="font-mono tabular-nums text-ink">{formatINR(row.original.amount)}</span>,
  },
  { accessorKey: "channel", header: "Channel", cell: ({ row }) => <Badge tone="outline" size="sm">{row.original.channel}</Badge> },
];

const DECISION_TYPE_LABEL: Record<DecisionType, string> = {
  FILE_STR: "File STR",
  FILE_CPFIR: "File CPFIR",
  MONITOR: "Monitor",
  CLOSE: "Close",
};

function DecisionRow({
  decision,
  actor,
  caseId,
}: {
  decision: Decision;
  actor: string;
  caseId: string;
}) {
  const approve = useApproveDecision();
  const reject = useRejectDecision();
  const makerIsActor = decision.maker === actor;
  const pending = decision.status === "PENDING";

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] text-ink-3">#{decision.id}</span>
        <span className="text-[12px] font-medium text-ink">{DECISION_TYPE_LABEL[decision.decisionType]}</span>
        <StatusBadge status={decision.status} />
        <span className="ml-auto font-mono text-[9.5px] text-ink-3">
          {formatDateTimeIST(decision.createdAt)}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-ink-3">
        grounds <span className="font-mono text-ink-2">{decision.grounds || "—"}</span> · maker{" "}
        <span className="text-ink-2">{decision.maker}</span> · checker{" "}
        <span className="text-ink-2">{decision.checker ?? "pending"}</span>
      </p>
      <p className="mt-1.5 whitespace-pre-wrap text-[11.5px] leading-relaxed text-ink-2">{decision.rationale}</p>
      {pending ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            size="xs"
            variant="secondary"
            disabled={approve.isPending || makerIsActor}
            onClick={() => approve.mutate({ decisionId: decision.id, checker: actor, caseId })}
          >
            {approve.isPending ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
            Approve as {actor}
          </Button>
          <Button
            size="xs"
            variant="ghost"
            className="text-critical"
            disabled={reject.isPending}
            onClick={() =>
              reject.mutate({
                decisionId: decision.id,
                checker: actor,
                caseId,
                reason: "Rejected from case workspace.",
              })
            }
          >
            <X className="size-3" /> Reject
          </Button>
          {makerIsActor ? (
            <span className="text-[10.5px] text-medium">
              Maker and checker must differ. Switch role in the user menu.
            </span>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export default function CaseDetailPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params.caseId;
  const actor = useSessionStore((s) => s.actor);

  const { data, isLoading, isError, error, refetch } = useCase(caseId);
  const risk = useRisk(caseId);
  const transition = useTransitionCase();
  const propose = useProposeDecision();
  const file = useFileCase();

  const [transitionTo, setTransitionTo] = React.useState<CaseStatus | null>(null);
  const [reason, setReason] = React.useState("");
  const [decisionType, setDecisionType] = React.useState<DecisionType>("FILE_STR");
  const [grounds, setGrounds] = React.useState<string>(GROUNDS_OPTIONS[0].value);
  const [rationale, setRationale] = React.useState("");
  const [evidenceRefs, setEvidenceRefs] = React.useState("");

  if (isLoading) return <LoadingState title="Loading case" rows={8} />;
  if (isError || !data) {
    return (
      <ErrorState
        title="Case not found"
        description={(error as Error | null)?.message ?? "This case does not exist in the database."}
        onRetry={() => refetch()}
      />
    );
  }

  const statusAllows = (status: CaseStatus) => data.allowedTransitions.includes(status);
  const canPropose = data.status === "INVESTIGATING" || data.status === "TRIAGE";
  const pendingDecision = data.decisions.find((d) => d.status === "PENDING");
  const rationaleTooShort = rationale.trim().length < 30;

  return (
    <div className="space-y-3">
      <PageHeader
        eyebrow={
          <>
            <Link
              href="/app/cases"
              className="inline-flex items-center gap-1 text-[10.5px] text-ink-3 underline-offset-2 hover:text-ink hover:underline"
            >
              <ArrowLeft className="size-3" /> Cases
            </Link>
            <StatusBadge status={data.status} />
            <SeverityBadge severity={data.severity} />
            <span className="font-mono text-[10.5px] text-ink-3">{formatDateIST(data.createdAt)}</span>
          </>
        }
        title={data.title}
        description={`${formatNumber(data.alertCount)} alerts · ${formatNumber(data.transactions.length)} transactions · ${formatNumber(data.accounts.length)} account(s) · ${formatINRCompact(data.amount)}`}
        actions={
          <>
            {statusAllows("TRIAGE") && data.status === "NEW" ? (
              <Button size="sm" onClick={() => transition.mutate({ caseId, status: "TRIAGE", actor })}>
                Start triage <ArrowRight className="size-3.5" />
              </Button>
            ) : null}
            {statusAllows("INVESTIGATING") && data.status === "TRIAGE" ? (
              <Button size="sm" onClick={() => transition.mutate({ caseId, status: "INVESTIGATING", actor })}>
                Begin investigation <ArrowRight className="size-3.5" />
              </Button>
            ) : null}
            {statusAllows("FILED") ? (
              <Button size="sm" onClick={() => file.mutate({ caseId, actor })} disabled={file.isPending}>
                {file.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Lock className="size-3.5" />}
                Mark as filed
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href={stageHref("graph", caseId)}>
                <Network className="size-3.5" /> Money trail
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={stageHref("score", caseId)}>
                <Gauge className="size-3.5" /> Score
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-3 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-8">
          <Panel>
            <PanelHeader
              title="Decision workspace"
              description="A maker proposes; a different person approves. Approval automatically moves the case to DECIDED."
              actions={
                <Badge tone={pendingDecision ? "pending" : "neutral"} size="sm">
                  {pendingDecision ? "awaiting checker" : "no pending decision"}
                </Badge>
              }
            />
            {!canPropose && !pendingDecision ? (
              <div className="px-4 py-3">
                <Callout tone="neutral">
                  {data.status === "DECIDED" || data.status === "FILED"
                    ? "The decision has been approved. Continue to Reports to render the filing, or mark the case filed."
                    : "Move the case to INVESTIGATING before proposing a decision."}
                </Callout>
              </div>
            ) : (
              <div className="space-y-3 p-4">
                {canPropose ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Decision type" htmlFor="decision-type">
                      <SimpleSelect
                        value={decisionType}
                        onValueChange={(v) => setDecisionType(v as DecisionType)}
                        options={DECISION_TYPES.map((d) => ({ value: d.value, label: d.label }))}
                        label="Decision type"
                      />
                    </Field>
                    <Field label="Grounds" htmlFor="grounds">
                      <SimpleSelect
                        value={grounds}
                        onValueChange={setGrounds}
                        options={GROUNDS_OPTIONS.map((g) => ({ value: g.value, label: g.label }))}
                        label="Grounds"
                      />
                    </Field>
                    <Field
                      label="Rationale"
                      hint={`${rationale.trim().length}/30 minimum`}
                      error={rationale.length > 0 && rationaleTooShort ? "At least 30 characters are required by core.workflow." : undefined}
                      className="sm:col-span-2"
                      htmlFor="rationale"
                    >
                      <Textarea
                        id="rationale"
                        value={rationale}
                        onChange={(e) => setRationale(e.target.value)}
                        placeholder="Record the specific behaviour, accounts, amounts and why the decision follows."
                        rows={4}
                      />
                    </Field>
                    <Field label="Evidence references" hint="optional" htmlFor="evidence-refs" className="sm:col-span-2">
                      <Input
                        id="evidence-refs"
                        value={evidenceRefs}
                        onChange={(e) => setEvidenceRefs(e.target.value)}
                        placeholder="e.g. #1,#2"
                      />
                    </Field>
                  </div>
                ) : null}
                {canPropose ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10.5px] text-ink-3">
                      Maker is recorded as <span className="font-medium text-ink-2">{actor}</span>.
                    </p>
                    <Button
                      size="sm"
                      disabled={propose.isPending || rationaleTooShort}
                      onClick={() =>
                        propose.mutate({
                          caseId,
                          input: {
                            decision_type: decisionType,
                            grounds,
                            rationale: rationale.trim(),
                            maker: actor,
                            evidence_refs: evidenceRefs.trim() || undefined,
                          },
                        })
                      }
                    >
                      {propose.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Scale className="size-3.5" />}
                      Propose decision
                    </Button>
                  </div>
                ) : null}

                {data.decisions.length > 0 ? (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {data.decisions.map((decision) => (
                      <DecisionRow key={decision.id} decision={decision} actor={actor} caseId={caseId} />
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] text-ink-3">No decision has been proposed for this case.</p>
                )}
              </div>
            )}
          </Panel>

          <Tabs defaultValue="alerts">
            <TabsList>
              <TabsTrigger value="alerts">Alerts ({data.alerts.length})</TabsTrigger>
              <TabsTrigger value="transactions">Transactions ({data.transactions.length})</TabsTrigger>
              <TabsTrigger value="evidence">Evidence ({data.evidence.length})</TabsTrigger>
              <TabsTrigger value="audit">Audit ({data.audit.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="alerts" className="mt-3">
              <DataTable
                data={data.alerts}
                columns={ALERT_COLUMNS}
                searchPlaceholder="Filter this case's alerts…"
                emptyTitle="No alerts linked"
                maxHeight={420}
                getRowId={(row) => row.alertId}
              />
            </TabsContent>
            <TabsContent value="transactions" className="mt-3">
              <DataTable
                data={data.transactions}
                columns={TXN_COLUMNS}
                searchPlaceholder="Filter this case's transactions…"
                emptyTitle="No transactions linked"
                maxHeight={420}
                getRowId={(row) => row.txnId}
              />
            </TabsContent>
            <TabsContent value="evidence" className="mt-3">
              <Panel>
                <PanelHeader
                  title="Evidence sealed for this case"
                  description="Verification is global because the hash chain orders every case's items together."
                  actions={
                    <Button asChild variant="outline" size="xs">
                      <Link href={stageHref("evidence", caseId)}>
                        <Fingerprint className="size-3" /> Open Evidence
                      </Link>
                    </Button>
                  }
                />
                {data.evidence.length === 0 ? (
                  <p className="px-4 py-3 text-[11px] text-ink-3">
                    No evidence is attached. Seal an item from the Evidence segment.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {data.evidence.map((item) => (
                      <li key={item.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[11px]">
                        <span className="font-mono text-[10px] text-ink-3">#{item.id}</span>
                        <span className="min-w-0 flex-1 truncate text-ink-2">{item.filename}</span>
                        <Badge tone="outline" size="sm">{item.kind}</Badge>
                        <HashValue hash={item.fileHash} state="pending" />
                        <Button asChild variant="ghost" size="icon-sm" aria-label={`Download ${item.filename}`}>
                          <a href={api.evidenceDownloadUrl(item.id)}>
                            <Download className="size-3.5" />
                          </a>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </TabsContent>
            <TabsContent value="audit" className="mt-3">
              <Panel>
                <PanelHeader title="Case audit trail" description="Every recorded action that names this case" />
                {data.audit.length === 0 ? (
                  <p className="px-4 py-3 text-[11px] text-ink-3">No audit entries reference this case yet.</p>
                ) : (
                  <ol className="divide-y divide-border">
                    {data.audit.map((entry) => (
                      <li key={entry.id} className="flex items-start gap-3 px-4 py-2.5">
                        <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[10.5px] text-ink-2">{entry.action}</span>
                            <span className="text-[10px] text-ink-3">{entry.actor}</span>
                            <span className="ml-auto font-mono text-[9.5px] text-ink-3">
                              {formatDateTimeIST(entry.createdAt)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-ink-3">{entry.details}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </Panel>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-3 xl:col-span-4">
          <Panel>
            <PanelHeader title="Workflow position" description="Transitions allowed from the current status" />
            <div className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <StatusBadge status={data.status} />
                <span className="text-[10.5px] text-ink-3">
                  {data.allowedTransitions.length
                    ? `→ ${data.allowedTransitions.join(", ")}`
                    : "terminal status"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.allowedTransitions
                  .filter((s) => s !== "DECIDED")
                  .map((s) => (
                    <Button key={s} variant="outline" size="xs" onClick={() => setTransitionTo(s)}>
                      Move to {s}
                    </Button>
                  ))}
                {statusAllows("DECIDED") ? (
                  <span className="text-[10.5px] leading-relaxed text-ink-3">
                    DECIDED is set automatically when a different user approves the decision.
                  </span>
                ) : null}
              </div>
              {data.status === "NEW" ? (
                <p className="text-[10.5px] text-ink-3">Start triage before investigating.</p>
              ) : null}
              {data.status === "INVESTIGATING" && !pendingDecision ? (
                <p className="text-[10.5px] text-ink-3">Propose a decision to move on.</p>
              ) : null}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Live risk"
              description="Computed on request by the model"
              actions={
                <Button asChild variant="ghost" size="xs">
                  <Link href={stageHref("score", caseId)}>Details</Link>
                </Button>
              }
            />
            <div className="px-4 py-4">
              {risk.isLoading ? (
                <p className="text-[11px] text-ink-3">Scoring…</p>
              ) : risk.isError || !risk.data ? (
                <p className="text-[11px] text-ink-3">
                  {(risk.error as Error | null)?.message ?? "Score unavailable."}
                </p>
              ) : (
                <RiskDial
                  score={risk.data.score}
                  band={risk.data.band}
                  size={78}
                  label={risk.data.model}
                  caption={`${risk.data.reasons.length} driver(s)`}
                />
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Accounts" description="Accounts named in the linked alerts" />
            {data.accounts.length === 0 ? (
              <p className="px-4 py-3 text-[11px] text-ink-3">No account IDs on the linked alerts.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.accounts.map((account) => (
                  <li key={account.accountId} className="flex items-center gap-2 px-4 py-2">
                    <span className="font-mono text-[11px] text-ink-2">{account.accountId}</span>
                    <span className="ml-auto font-mono text-[10px] text-ink-3">{account.alertCount} alerts</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Objects" description="What this case contains" />
            <div className="grid grid-cols-2 divide-x divide-y divide-border">
              <div className="px-4 py-3"><Metric label="Alerts" value={formatNumber(data.alerts.length)} /></div>
              <div className="px-4 py-3"><Metric label="Transactions" value={formatNumber(data.transactions.length)} /></div>
              <div className="px-4 py-3"><Metric label="Evidence" value={formatNumber(data.evidence.length)} /></div>
              <div className="px-4 py-3"><Metric label="Decisions" value={formatNumber(data.decisions.length)} /></div>
            </div>
            <div className="flex flex-wrap gap-2 border-t border-border px-4 py-2.5">
              <Button asChild variant="outline" size="xs">
                <Link href={stageHref("report", caseId)}>
                  <ShieldCheck className="size-3" /> Reports
                </Link>
              </Button>
              <Button asChild variant="ghost" size="xs">
                <Link href={stageHref("evidence", caseId)}>
                  <Fingerprint className="size-3" /> Evidence
                </Link>
              </Button>
            </div>
          </Panel>

          <Panel className="px-4 py-3">
            <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-ink-3">Identifiers</p>
            <p className="mt-1 font-mono text-[10.5px] text-ink-2">{data.caseId}</p>
            <p className="mt-1 text-[10px] leading-relaxed text-ink-3">
              Shared keys: {data.sharedKeys.length ? data.sharedKeys.join(", ") : "none"}
            </p>
            <p className="mt-2 flex items-center gap-1 text-[10px] text-ink-3">
              <Siren className="size-3" aria-hidden /> Severity follows the highest alert in the candidate.
            </p>
          </Panel>
        </div>
      </div>

      <Dialog
        open={transitionTo !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTransitionTo(null);
            setReason("");
          }
        }}
      >
        {transitionTo ? (
          <DialogContent className="max-w-md">
            <DialogHeader
              title={`Move case to ${transitionTo}`}
              description="The transition is validated by core.workflow and written to the audit log."
            />
            <Field label="Reason" hint="optional" htmlFor="transition-reason">
              <Input
                id="transition-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is the case moving now?"
              />
            </Field>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setTransitionTo(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={transition.isPending}
                onClick={() =>
                  transition.mutate(
                    { caseId, status: transitionTo, actor, reason },
                    {
                      onSuccess: () => {
                        setTransitionTo(null);
                        setReason("");
                      },
                    },
                  )
                }
              >
                {transition.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <GitBranch className="size-3.5" />}
                Confirm transition
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
