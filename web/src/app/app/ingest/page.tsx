"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Database,
  FileUp,
  Loader2,
  ShieldAlert,
  Table2,
  Upload,
} from "lucide-react";
import type { Alert, IngestBatchResult, Transaction } from "@/types";
import {
  useAlerts,
  useDataset,
  useIngestSample,
  useTransactions,
  useUploadCsv,
} from "@/lib/queries";
import { formatDateTimeIST, formatINR, formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/console/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Badge, SeverityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SimpleSelect } from "@/components/ui/field";
import {
  Callout,
  EmptyState,
  ErrorState,
  LoadingState,
  Metric,
  Panel,
  PanelHeader,
} from "@/components/ui/misc";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/overlays";

function ResultPanel({ result }: { result?: IngestBatchResult }) {
  if (!result) return null;
  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        title="Last ingest batch"
        description={`Completed in ${result.durationMs} ms`}
        actions={
          <Badge tone={result.rejected.length ? "medium" : "verified"} size="sm">
            {result.rejected.length ? `${result.rejected.length} rejected` : "clean batch"}
          </Badge>
        }
      />
      <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
        <div className="px-4 py-3"><Metric label="Received" value={formatNumber(result.received)} /></div>
        <div className="px-4 py-3"><Metric label="Accepted" value={formatNumber(result.accepted)} /></div>
        <div className="px-4 py-3"><Metric label="Duplicates" value={formatNumber(result.duplicates)} /></div>
        <div className="px-4 py-3"><Metric label="Rejected" value={formatNumber(result.rejected.length)} /></div>
      </div>
      {result.rejected.length > 0 ? (
        <div className="border-t border-border">
          <p className="px-4 pt-3 text-[10px] font-medium uppercase tracking-[0.09em] text-ink-3">
            Rejected rows
          </p>
          <ul className="divide-y divide-border">
            {result.rejected.slice(0, 8).map((row, index) => (
              <li key={`${row.row}-${index}`} className="flex items-start gap-3 px-4 py-2 text-[11px]">
                <span className="font-mono text-[10px] text-ink-3">row {row.row ?? "?"}</span>
                <span className="text-ink-2">{row.reason}</span>
              </li>
            ))}
          </ul>
          {result.rejected.length > 8 ? (
            <p className="px-4 py-2 text-[10px] text-ink-3">
              +{result.rejected.length - 8} more rejected rows.
            </p>
          ) : null}
        </div>
      ) : null}
    </Panel>
  );
}

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
  {
    accessorKey: "caseId",
    header: "Case",
    cell: ({ row }) =>
      row.original.caseId ? (
        <span className="font-mono text-[10.5px] text-accent-ink">{row.original.caseId}</span>
      ) : (
        <span className="text-[10.5px] text-ink-3">unlinked</span>
      ),
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
    cell: ({ row }) => <span className="font-mono text-[10.5px] text-ink-2">{row.original.toAccount || row.original.toVpa}</span>,
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => <span className="font-mono tabular-nums text-ink">{formatINR(row.original.amount)}</span>,
  },
  { accessorKey: "channel", header: "Channel", cell: ({ row }) => <Badge tone="outline" size="sm">{row.original.channel}</Badge> },
  { accessorKey: "city", header: "City", cell: ({ row }) => <span className="text-[10.5px] text-ink-3">{row.original.city}</span> },
];

export default function IngestPage() {
  const { data: dataset, isLoading: datasetLoading, isError: datasetError, refetch } = useDataset();
  const alerts = useAlerts({ limit: 1000 });
  const transactions = useTransactions({ limit: 1000 });
  const sample = useIngestSample();
  const upload = useUploadCsv();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [kind, setKind] = React.useState<"alerts" | "transactions">("alerts");
  const [lastResult, setLastResult] = React.useState<IngestBatchResult | undefined>();

  function ingestSample(which: "alerts" | "dirty" | "transactions") {
    sample.mutate(which, { onSuccess: setLastResult });
  }

  if (datasetLoading) return <LoadingState title="Reading dataset state" rows={6} />;
  if (datasetError || !dataset) return <ErrorState title="Dataset unavailable" onRetry={() => refetch()} />;

  return (
    <div className="space-y-3">
      <PageHeader
        eyebrow={<Badge tone="outline" size="sm">segment 01</Badge>}
        title="Ingest"
        description="Load the sample corpus or your own UTF-8 CSV. The API validates each row against the SQLite schema, rejects malformed records and deduplicates on the primary key."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={upload.isPending}
          >
            {upload.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            Upload CSV
          </Button>
        }
        meta={
          <>
            <span className="text-[11px] text-ink-3">
              {formatNumber(dataset.transactions)} transactions · {formatNumber(dataset.alerts)} alerts in the database
            </span>
            <SimpleSelect
              value={kind}
              onValueChange={setKind}
              label="Upload kind"
              className="h-7 w-[160px] text-[11px]"
              options={[
                { value: "alerts", label: "Alert rows" },
                { value: "transactions", label: "Transaction rows" },
              ]}
            />
          </>
        }
      />

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        aria-label="Upload a CSV file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) upload.mutate({ file, kind }, { onSuccess: setLastResult });
          event.target.value = "";
        }}
      />

      <Panel>
        <PanelHeader
          title="Sample feeds"
          description="These buttons call the same core.ingest functions the Streamlit app used."
        />
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <div className="space-y-2">
            <p className="text-[11.5px] font-medium text-ink-2">Transactions</p>
            <p className="text-[10.5px] leading-relaxed text-ink-3">
              data/synthetic_transactions.csv · 5,005 rows.
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => ingestSample("transactions")}
              disabled={sample.isPending}
            >
              <Table2 className="size-3.5" /> Ingest transactions
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-[11.5px] font-medium text-ink-2">Valid alerts</p>
            <p className="text-[10.5px] leading-relaxed text-ink-3">
              data/synthetic_alerts.csv · 300 rows, all schema-valid.
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => ingestSample("alerts")}
              disabled={sample.isPending}
            >
              <Database className="size-3.5" /> Ingest alerts
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-[11.5px] font-medium text-ink-2">Dirty alerts</p>
            <p className="text-[10.5px] leading-relaxed text-ink-3">
              data/synthetic_alerts_dirty.csv · demonstrates row-level rejection.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => ingestSample("dirty")}
              disabled={sample.isPending}
            >
              <ShieldAlert className="size-3.5" /> Validate dirty batch
            </Button>
          </div>
        </div>
      </Panel>

      <ResultPanel result={lastResult} />

      {dataset.alerts === 0 && dataset.transactions === 0 ? (
        <Callout tone="neutral" title="Nothing ingested yet">
          Use one of the sample feeds above, or upload a CSV. Correlation needs alerts; the graph needs
          transactions.
        </Callout>
      ) : null}

      <Tabs defaultValue="alerts">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="alerts">Alerts ({formatNumber(dataset.alerts)})</TabsTrigger>
            <TabsTrigger value="transactions">Transactions ({formatNumber(dataset.transactions)})</TabsTrigger>
          </TabsList>
          <p className="text-[10.5px] text-ink-3">
            Up to 1,000 newest rows per table are shown; the counts above are exact.
          </p>
        </div>
        <TabsContent value="alerts" className="mt-3">
          {alerts.isLoading ? (
            <LoadingState rows={6} />
          ) : alerts.isError ? (
            <ErrorState title="Alerts unavailable" onRetry={() => alerts.refetch()} />
          ) : (
            <DataTable
              data={alerts.data?.items ?? []}
              columns={ALERT_COLUMNS}
              searchPlaceholder="Filter alerts by ID, account or rule…"
              savedViewKey="ingest-alerts"
              emptyTitle="No alerts"
              emptyDescription="Ingest the alert feed to populate this table."
              getRowId={(row) => row.alertId}
            />
          )}
        </TabsContent>
        <TabsContent value="transactions" className="mt-3">
          {transactions.isLoading ? (
            <LoadingState rows={6} />
          ) : transactions.isError ? (
            <ErrorState title="Transactions unavailable" onRetry={() => transactions.refetch()} />
          ) : (
            <DataTable
              data={transactions.data?.items ?? []}
              columns={TXN_COLUMNS}
              searchPlaceholder="Filter transactions by ID, account or VPA…"
              savedViewKey="ingest-transactions"
              emptyTitle="No transactions"
              emptyDescription="Ingest the transaction feed to populate this table."
              getRowId={(row) => row.txnId}
            />
          )}
        </TabsContent>
      </Tabs>

      {dataset.alerts === 0 ? (
        <Panel>
          <EmptyState
            icon={FileUp}
            title="No alert rows"
            description="The alert table drives correlation. Ingest the valid alerts sample or upload a CSV with the same columns."
          />
        </Panel>
      ) : null}
    </div>
  );
}
