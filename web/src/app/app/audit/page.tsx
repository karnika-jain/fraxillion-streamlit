"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ScrollText, ShieldCheck } from "lucide-react";
import type { AuditEntry } from "@/types";
import { useAudit } from "@/lib/queries";
import { formatDateTimeIST, formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/console/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Input, SimpleSelect } from "@/components/ui/field";
import { Callout, ErrorState, LoadingState, Metric, Panel } from "@/components/ui/misc";

const COLUMNS: ColumnDef<AuditEntry>[] = [
  {
    accessorKey: "createdAt",
    header: "Time",
    cell: ({ row }) => (
      <span className="whitespace-nowrap font-mono text-[10.5px] text-ink-3">
        {formatDateTimeIST(row.original.createdAt)}
      </span>
    ),
  },
  {
    accessorKey: "actor",
    header: "Actor",
    cell: ({ row }) => <span className="font-mono text-[10.5px] text-ink-2">{row.original.actor || "SYSTEM"}</span>,
  },
  {
    accessorKey: "action",
    header: "Action",
    cell: ({ row }) => <Badge tone="outline" size="sm">{row.original.action}</Badge>,
  },
  {
    accessorKey: "objectType",
    header: "Object",
    cell: ({ row }) => (
      <span className="text-[10.5px] text-ink-3">
        {row.original.objectType}
        {row.original.objectId ? (
          <span className="ml-1 font-mono text-ink-2">{row.original.objectId}</span>
        ) : null}
      </span>
    ),
  },
  {
    accessorKey: "details",
    header: "Details",
    cell: ({ row }) => (
      <span className="block max-w-[560px] text-[11px] leading-relaxed text-ink-2">{row.original.details}</span>
    ),
  },
];

export default function AuditPage() {
  const [caseId, setCaseId] = React.useState("");
  const [action, setAction] = React.useState("all");
  const [actor, setActor] = React.useState("all");
  const { data, isLoading, isError, refetch } = useAudit({
    case_id: caseId.trim() || undefined,
    action: action === "all" ? undefined : action,
    actor: actor === "all" ? undefined : actor,
    limit: 1000,
  });

  const items = data?.items ?? [];

  return (
    <div className="space-y-3">
      <PageHeader
        eyebrow={<Badge tone="outline" size="sm">governance</Badge>}
        title="Audit log"
        description="Every mutating core function appends a row here. The table is append-only; this screen only reads and exports it."
        meta={
          <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-3">
            <ShieldCheck className="size-3.5 text-verified" aria-hidden />
            newest first · up to 1,000 rows loaded
          </span>
        }
      />

      <Panel className="grid grid-cols-3 divide-x divide-border">
        <div className="px-4 py-3"><Metric label="Rows shown" value={formatNumber(items.length)} /></div>
        <div className="px-4 py-3"><Metric label="Distinct actions" value={formatNumber(data?.actions.length ?? 0)} /></div>
        <div className="px-4 py-3"><Metric label="Distinct actors" value={formatNumber(data?.actors.length ?? 0)} /></div>
      </Panel>

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-[200px] space-y-1">
          <label htmlFor="audit-case" className="text-[11px] font-medium text-ink-2">Case ID</label>
          <Input
            id="audit-case"
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
            placeholder="e.g. CS-2026-0001"
            className="h-8 text-[12px]"
          />
        </div>
        <SimpleSelect
          value={action}
          onValueChange={setAction}
          label="Filter by action"
          className="w-[210px]"
          options={[
            { value: "all", label: "All actions" },
            ...(data?.actions ?? []).map((a) => ({
              value: a.action,
              label: `${a.action} (${a.count})`,
            })),
          ]}
        />
        <SimpleSelect
          value={actor}
          onValueChange={setActor}
          label="Filter by actor"
          className="w-[210px]"
          options={[
            { value: "all", label: "All actors" },
            ...(data?.actors ?? []).map((a) => ({
              value: a.actor,
              label: `${a.actor} (${a.count})`,
            })),
          ]}
        />
        {(caseId || action !== "all" || actor !== "all") && (
          <button
            type="button"
            className="text-[11px] text-ink-3 underline-offset-2 hover:text-ink hover:underline"
            onClick={() => {
              setCaseId("");
              setAction("all");
              setActor("all");
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {isLoading ? (
        <LoadingState title="Loading audit log" rows={8} />
      ) : isError ? (
        <ErrorState title="Audit log unavailable" onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <Panel className="flex flex-col items-center px-6 py-12 text-center">
          <ScrollText className="mb-3 size-6 text-ink-3" aria-hidden />
          <p className="text-[13px] font-semibold text-ink">No audit entries match</p>
          <p className="mt-1 max-w-md text-[11.5px] leading-relaxed text-ink-3">
            The log fills as you load data, accept candidates, transition cases, seal evidence and record
            decisions. Clear the filters if you expected other rows.
          </p>
        </Panel>
      ) : (
        <DataTable
          data={items}
          columns={COLUMNS}
          searchPlaceholder="Filter audit rows by actor, action or details…"
          savedViewKey="audit"
          maxHeight={640}
          emptyTitle="No audit entries"
          getRowId={(row) => String(row.id)}
        />
      )}

      <Callout tone="neutral" title="Export is a copy">
        The CSV button on the table downloads the rows currently visible in this browser. The canonical
        record remains the audit_log table in fraxillion.db.
      </Callout>
    </div>
  );
}
