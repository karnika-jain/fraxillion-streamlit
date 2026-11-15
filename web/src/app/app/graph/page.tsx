"use client";

import * as React from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CircleDot,
  Network,
  Route,
  Waypoints,
} from "lucide-react";
import type { GraphNode } from "@/types";
import { useGraph } from "@/lib/queries";
import { CasePicker, NoCases, useCaseParam } from "@/components/console/case-picker";
import { GraphCanvas } from "@/components/console/graph-canvas";
import { formatDateTimeIST, formatINR, formatINRCompact, formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/console/page-header";
import { Badge } from "@/components/ui/badge";
import { Label, SimpleSelect, Switch } from "@/components/ui/field";
import {
  Callout,
  ErrorState,
  LoadingState,
  Metric,
  Panel,
  PanelHeader,
} from "@/components/ui/misc";

function NodeInspector({ node }: { node: GraphNode | null }) {
  if (!node) return null;
  return (
    <div className="border-t border-border bg-surface-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <CircleDot className="size-3.5 text-accent" aria-hidden />
        <span className="font-mono text-[12px] font-medium text-ink">{node.id}</span>
        <Badge tone="outline" size="sm">{node.role}</Badge>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="In-degree" value={node.inDegree} />
        <Metric label="Out-degree" value={node.outDegree} />
        <Metric label="Amount in" value={formatINRCompact(node.amountIn)} />
        <Metric label="Amount out" value={formatINRCompact(node.amountOut)} />
      </div>
    </div>
  );
}

export default function GraphPage() {
  return <GraphPageInner />;
}

function GraphPageInner() {
  const { cases, caseId, setCaseId, isLoading } = useCaseParam();
  const [hops, setHops] = React.useState(2);
  const [showMiniMap, setShowMiniMap] = React.useState(true);
  const [selected, setSelected] = React.useState<string | null>(null);
  const graph = useGraph(caseId, hops);

  React.useEffect(() => {
    setSelected(null);
  }, [caseId, hops]);

  if (isLoading) return <LoadingState title="Loading cases" rows={5} />;
  if (!caseId) return <NoCases description="The graph is anchored on a case account. Create a case first." />;

  const selectedNode = graph.data?.nodes.find((n) => n.id === selected) ?? null;
  const focus = graph.data?.nodes.find((n) => n.id === graph.data?.focusAccount) ?? null;
  const relatedEdges = graph.data
    ? graph.data.edges.filter((e) => e.source === selected || e.target === selected)
    : [];

  return (
    <div className="space-y-3">
      <PageHeader
        eyebrow={<Badge tone="outline" size="sm">segment 04</Badge>}
        title="Graph"
        description="A directed ego-network built from the transaction table around the case focus account. Typologies below are detected by core.graph on the extracted subgraph, not pre-labelled."
        actions={
          <>
            <CasePicker cases={cases} caseId={caseId} onChange={setCaseId} />
            <SimpleSelect
              value={String(hops)}
              onValueChange={(v) => setHops(Number(v))}
              label="Hops"
              className="w-[110px]"
              options={[
                { value: "1", label: "1 hop" },
                { value: "2", label: "2 hops" },
                { value: "3", label: "3 hops" },
              ]}
            />
          </>
        }
        meta={
          <>
            <span className="text-[11px] text-ink-3">
              Focus <span className="font-mono text-ink-2">{graph.data?.focusAccount ?? "—"}</span>
            </span>
            <span className="flex items-center gap-2 text-[11px] text-ink-3">
              <Switch checked={showMiniMap} onCheckedChange={setShowMiniMap} id="minimap" />
              <Label htmlFor="minimap">Mini-map</Label>
            </span>
          </>
        }
      />

      {graph.isLoading ? (
        <LoadingState title="Building graph" rows={6} />
      ) : graph.isError || !graph.data ? (
        <ErrorState
          title="Graph unavailable"
          description={(graph.error as Error | null)?.message ?? "This case has no account or transactions to anchor."}
          onRetry={() => graph.refetch()}
        />
      ) : (
        <>
          <Panel className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 lg:grid-cols-6 lg:divide-y-0">
            <div className="px-4 py-3"><Metric label="Nodes" value={formatNumber(graph.data.nodes.length)} /></div>
            <div className="px-4 py-3"><Metric label="Edges" value={formatNumber(graph.data.edges.length)} /></div>
            <div className="px-4 py-3"><Metric label="Fan-out" value={formatNumber(graph.data.motifs.fanOut.length)} /></div>
            <div className="px-4 py-3"><Metric label="Fan-in" value={formatNumber(graph.data.motifs.fanIn.length)} /></div>
            <div className="px-4 py-3"><Metric label="Pass-through" value={formatNumber(graph.data.motifs.passThrough.length)} /></div>
            <div className="px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.08em] text-ink-3">Window</p>
              <p className="mt-1.5 text-[11px] text-ink-2">
                {graph.data.timeWindow
                  ? `${formatDateTimeIST(graph.data.timeWindow.from)} → ${formatDateTimeIST(graph.data.timeWindow.to)}`
                  : "—"}
              </p>
            </div>
          </Panel>

          <Panel className="overflow-hidden">
            <PanelHeader
              title="Money trail"
              description="Edge width is proportional to the aggregated amount between two accounts."
              actions={
                <Badge tone="outline" size="sm">
                  <Network className="size-3" /> {hops} hop{hops === 1 ? "" : "s"}
                </Badge>
              }
            />
            <GraphCanvas data={graph.data} selectedId={selected} onSelect={setSelected} showMiniMap={showMiniMap} />
            {selectedNode ? <NodeInspector node={selectedNode} /> : null}
            {selected ? (
              <div className="border-t border-border px-4 py-3">
                <p className="text-[10px] font-medium uppercase tracking-[0.09em] text-ink-3">
                  Edges touching {selected}
                </p>
                {relatedEdges.length === 0 ? (
                  <p className="mt-1.5 text-[11px] text-ink-3">This node has no edges in the selected hops.</p>
                ) : (
                  <ul className="mt-2 divide-y divide-border">
                    {relatedEdges.map((edge) => {
                      const outgoing = edge.source === selected;
                      return (
                        <li key={edge.id} className="flex flex-wrap items-center gap-2 py-1.5 text-[11px]">
                          {outgoing ? (
                            <ArrowUpRight className="size-3.5 text-critical" aria-hidden />
                          ) : (
                            <ArrowDownLeft className="size-3.5 text-verified" aria-hidden />
                          )}
                          <span className="font-mono text-ink-2">
                            {edge.source} → {edge.target}
                          </span>
                          <span className="ml-auto font-mono tabular-nums text-ink">{formatINR(edge.amount)}</span>
                          <span className="font-mono text-[10px] text-ink-3">{edge.count} txn(s)</span>
                          <span className="font-mono text-[10px] text-ink-3">{formatDateTimeIST(edge.lastAt)}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ) : null}
            <div className="border-t border-border px-4 py-2 text-[10px] text-ink-3">
              Click a node to isolate its edges. Focus {focus ? `${focus.id} (${focus.outDegree} out, ${focus.inDegree} in)` : "—"}.
            </div>
          </Panel>

          <div className="grid gap-3 lg:grid-cols-3">
            <Panel>
              <PanelHeader title="Fan-out" description="One source, many beneficiaries" />
              {graph.data.motifs.fanOut.length === 0 ? (
                <p className="px-4 py-3 text-[11px] text-ink-3">No fan-out detected.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {graph.data.motifs.fanOut.map((hit) => (
                    <li key={`${hit.node}-${hit.windowStart}`} className="px-4 py-2.5 text-[11px]">
                      <div className="flex items-center gap-2">
                        <Route className="size-3.5 text-critical" aria-hidden />
                        <span className="font-mono text-ink-2">{hit.node}</span>
                        <span className="ml-auto font-mono text-ink">{formatINRCompact(hit.totalAmount)}</span>
                      </div>
                      <p className="mt-0.5 text-[10.5px] text-ink-3">
                        {hit.targets} targets from {formatDateTimeIST(hit.windowStart)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel>
              <PanelHeader title="Fan-in" description="Many sources, one beneficiary" />
              {graph.data.motifs.fanIn.length === 0 ? (
                <p className="px-4 py-3 text-[11px] text-ink-3">No fan-in detected.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {graph.data.motifs.fanIn.map((hit) => (
                    <li key={`${hit.node}-${hit.windowStart}`} className="px-4 py-2.5 text-[11px]">
                      <div className="flex items-center gap-2">
                        <Waypoints className="size-3.5 text-medium" aria-hidden />
                        <span className="font-mono text-ink-2">{hit.node}</span>
                        <span className="ml-auto font-mono text-ink">{formatINRCompact(hit.totalAmount)}</span>
                      </div>
                      <p className="mt-0.5 text-[10.5px] text-ink-3">
                        {hit.sources} sources from {formatDateTimeIST(hit.windowStart)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel>
              <PanelHeader title="Pass-through" description="Inflow routed straight out" />
              {graph.data.motifs.passThrough.length === 0 ? (
                <p className="px-4 py-3 text-[11px] text-ink-3">No pass-through detected.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {graph.data.motifs.passThrough.map((hit) => (
                    <li key={hit.node} className="px-4 py-2.5 text-[11px]">
                      <div className="flex items-center gap-2">
                        <CircleDot className="size-3.5 text-accent" aria-hidden />
                        <span className="font-mono text-ink-2">{hit.node}</span>
                        <span className="ml-auto font-mono text-ink">{formatINRCompact(hit.outflow)}</span>
                      </div>
                      <p className="mt-0.5 text-[10.5px] text-ink-3">
                        in {formatINRCompact(hit.inflow)} · ratio {hit.ratio.toFixed(2)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <Callout tone="neutral">
            Typologies are explainable heuristics over the subgraph, not a fraud determination. The case
            decision and approval are recorded in the case workspace.
          </Callout>
        </>
      )}
    </div>
  );
}
