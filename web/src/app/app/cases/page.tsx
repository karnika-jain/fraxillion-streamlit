"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { GitBranch } from "lucide-react";
import type { CaseSummary } from "@/types";
import { useCases } from "@/lib/queries";
import { formatDateTimeIST, formatINR, formatINRCompact, formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/console/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Badge, SeverityBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SimpleSelect } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingState, Metric, Panel } from "@/components/ui/misc";

const CASE_COLUMNS: ColumnDef<CaseSummary>[] = [
  {
    accessorKey: "caseId",
    header: "Case",
    cell: ({ row }) => <span className="font-mono text-[11px] text-ink">{row.original.caseId}</span>,
  },
  {
    accessorKey: "title",
    header: "Title",
    cell: ({ row }) => <span className="block max-w-[320px] truncate text-ink-2">{row.original.title}</span>,
  },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
  {
    accessorKey: "severity",
    header: "Severity",
    cell: ({ row }) => <SeverityBadge severity={row.original.severity} showIcon={false} />,
  },
  {
    accessorKey: "amount",
    header: "Value",
    cell: ({ row }) => <span className="font-mono tabular-nums">{formatINR(row.original.amount)}</span>,
  },
  {
    accessorKey: "alertCount",
    header: "Alerts",
    cell: ({ row }) => <span className="font-mono tabular-nums text-ink-2">{row.original.alertCount}</span>,
  },
  {
    accessorKey: "evidenceCount",
    header: "Evidence",
    cell: ({ row }) => <span className="font-mono tabular-nums text-ink-2">{row.original.evidenceCount}</span>,
  },
  {
    accessorKey: "decisionCount",
    header: "Decisions",
    cell: ({ row }) => <span className="font-mono tabular-nums text-ink-2">{row.original.decisionCount}</span>,
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-[10.5px] text-ink-3">{formatDateTimeIST(row.original.createdAt)}</span>
    ),
  },
];

export default function CasesPage() {
  const router = useRouter();
  const [status, setStatus] = React.useState("all");
  const [severity, setSeverity] = React.useState("all");
  const { data, isLoading, isError, refetch } = useCases({
    status: status === "all" ? undefined : status,
    severity: severity === "all" ? undefined : severity,
  });
  const cases = data ?? [];

  const totalValue = cases.reduce((sum, c) => sum + c.amount, 0);
  const open = cases.filter((c) => !["FILED", "CLOSED"].includes(c.status)).length;

  return (
    <div className="space-y-3">
      <PageHeader
        eyebrow={<Badge tone="outline" size="sm">segment 05</Badge>}
        title="Cases"
        description="A case is created only by accepting a correlation candidate. Open one to see its alerts, transactions, evidence, decisions and audit trail, and to move it through the workflow."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/app/correlate">
              <GitBranch className="size-3.5" /> Correlate alerts
            </Link>
          </Button>
        }
      />

      <Panel className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
        <div className="px-4 py-3"><Metric label="Cases" value={formatNumber(cases.length)} /></div>
        <div className="px-4 py-3"><Metric label="Open" value={formatNumber(open)} /></div>
        <div className="px-4 py-3"><Metric label="Value" value={formatINRCompact(totalValue)} /></div>
        <div className="px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-3">Pending decisions</p>
          <p className="mt-1.5 text-2xl font-medium tracking-[-0.03em] text-ink">
            {formatNumber(cases.reduce((sum, c) => sum + c.decisionCount, 0))}
          </p>
          <p className="mt-1 text-[11px] text-ink-3">across the filtered cases</p>
        </div>
      </Panel>

      <div className="flex flex-wrap items-center gap-2">
        <SimpleSelect
          value={status}
          onValueChange={setStatus}
          label="Filter by status"
          className="w-[180px]"
          options={[
            { value: "all", label: "All statuses" },
            { value: "NEW", label: "New" },
            { value: "TRIAGE", label: "Triage" },
            { value: "INVESTIGATING", label: "Investigating" },
            { value: "DECIDED", label: "Decided" },
            { value: "FILED", label: "Filed" },
            { value: "CLOSED", label: "Closed" },
          ]}
        />
        <SimpleSelect
          value={severity}
          onValueChange={setSeverity}
          label="Filter by severity"
          className="w-[180px]"
          options={[
            { value: "all", label: "All severities" },
            { value: "CRITICAL", label: "Critical" },
            { value: "HIGH", label: "High" },
            { value: "MEDIUM", label: "Medium" },
            { value: "LOW", label: "Low" },
          ]}
        />
        <Link href="/app/correlate" className="ml-auto text-[11px] text-ink-3 underline-offset-2 hover:text-ink hover:underline">
          Need another case? Accept a candidate
        </Link>
      </div>

      {isLoading ? (
        <LoadingState title="Loading cases" rows={6} />
      ) : isError ? (
        <ErrorState title="Cases unavailable" onRetry={() => refetch()} />
      ) : cases.length === 0 ? (
        <Panel>
          <EmptyState
            icon={GitBranch}
            title={status === "all" && severity === "all" ? "No cases yet" : "No cases match these filters"}
            description={
              status === "all" && severity === "all"
                ? "Correlation has not produced a case. Run it on the ingested alerts and accept a candidate."
                : "Clear the filters or create a case from a correlation candidate."
            }
            action={
              <Button asChild size="sm">
                <Link href="/app/correlate">Open Correlate</Link>
              </Button>
            }
          />
        </Panel>
      ) : (
        <DataTable
          data={cases}
          columns={CASE_COLUMNS}
          searchPlaceholder="Filter cases by ID or title…"
          savedViewKey="cases"
          onRowClick={(row) => router.push(`/app/cases/${row.caseId}`)}
          emptyTitle="No cases"
          getRowId={(row) => row.caseId}
        />
      )}
    </div>
  );
}
