"use client";

import * as React from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Landmark, UserRound, Wallet } from "lucide-react";
import type { GraphData, GraphNode } from "@/types";
import { cn, formatINRCompact } from "@/lib/utils";

type FraxNodeData = {
  node: GraphNode;
  selected: boolean;
  dimmed: boolean;
};

const ROLE_COLOR: Record<GraphNode["role"], string> = {
  focus: "var(--accent)",
  suspect: "var(--critical)",
  counterparty: "var(--graph-node-ink, var(--ink-3))",
};

const ROLE_ICON = {
  focus: Landmark,
  suspect: UserRound,
  counterparty: Wallet,
} as const;

function FraxNode({ data }: NodeProps<Node<FraxNodeData>>) {
  const { node, selected, dimmed } = data;
  const Icon = ROLE_ICON[node.role];
  const color = ROLE_COLOR[node.role];
  return (
    <div
      className={cn(
        "w-[172px] rounded-lg border bg-surface px-2.5 py-2 text-left shadow-sm transition-opacity",
        selected ? "border-accent ring-2 ring-ring/40" : "border-border",
        dimmed && "opacity-35",
      )}
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <Handle type="target" position={Position.Left} className="!left-0" />
      <div className="flex items-center gap-1.5">
        <Icon className="size-3 shrink-0" style={{ color }} aria-hidden />
        <span className="font-mono text-[10.5px] font-medium text-ink">{node.id}</span>
        <span className="ml-auto font-mono text-[8.5px] uppercase tracking-[0.06em] text-ink-3">
          {node.role}
        </span>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1 border-t border-border pt-1 text-[9px]">
        <span className="text-ink-3">
          in <span className="font-mono tabular-nums text-ink-2">{node.inDegree}</span>
        </span>
        <span className="text-right text-ink-3">
          out <span className="font-mono tabular-nums text-ink-2">{node.outDegree}</span>
        </span>
        <span className="font-mono tabular-nums text-ink-2">{formatINRCompact(node.amountIn)}</span>
        <span className="text-right font-mono tabular-nums text-ink-2">
          {formatINRCompact(node.amountOut)}
        </span>
      </div>
      <Handle type="source" position={Position.Right} className="!right-0" />
    </div>
  );
}

const nodeTypes = { frax: FraxNode };

export function GraphCanvas({
  data,
  selectedId,
  onSelect,
  height = 560,
  showMiniMap = false,
}: {
  data: GraphData;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  height?: number;
  showMiniMap?: boolean;
}) {
  const maxAmount = React.useMemo(
    () => Math.max(1, ...data.edges.map((e) => e.amount)),
    [data.edges],
  );

  const nodes = React.useMemo<Node<FraxNodeData>[]>(
    () =>
      data.nodes.map((node) => ({
        id: node.id,
        type: "frax",
        position: { x: node.x, y: node.y },
        data: {
          node,
          selected: selectedId === node.id,
          dimmed: Boolean(selectedId) && selectedId !== node.id,
        },
        draggable: true,
        selectable: true,
      })),
    [data.nodes, selectedId],
  );

  const edges = React.useMemo<Edge[]>(
    () =>
      data.edges.map((edge) => {
        const active = !selectedId || edge.source === selectedId || edge.target === selectedId;
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: "smoothstep",
          animated: false,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 14,
            height: 14,
            color: "var(--graph-edge-active, var(--accent))",
          },
          style: {
            stroke: "var(--graph-edge-active, var(--accent))",
            strokeWidth: Math.max(1.2, Math.min(3.6, (edge.amount / maxAmount) * 3.6)),
            opacity: active ? 0.85 : 0.18,
          },
          label: active ? formatINRCompact(edge.amount) : undefined,
          labelStyle: { fill: "var(--ink-2)", fontSize: 9, fontFamily: "var(--font-geist-mono)" },
          labelBgStyle: { fill: "var(--surface)", fillOpacity: 0.86 },
          labelBgPadding: [3, 1] as [number, number],
          labelBgBorderRadius: 2,
        };
      }),
    [data.edges, selectedId, maxAmount],
  );

  return (
    <div style={{ height }} className="relative overflow-hidden rounded-b-xl bg-surface-2">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.22, maxZoom: 1.1 }}
        minZoom={0.35}
        maxZoom={1.8}
        nodesConnectable={false}
        onNodeClick={(_, node) => onSelect?.(selectedId === node.id ? null : node.id)}
        onPaneClick={() => onSelect?.(null)}
        proOptions={{ hideAttribution: false }}
        aria-label="Directed money-trail graph. Tab to reach nodes; click a node to focus its edges."
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="var(--border)" />
        <Controls showInteractive={false} />
        {showMiniMap ? (
          <MiniMap
            pannable
            zoomable
            maskColor="color-mix(in srgb, var(--bg) 72%, transparent)"
            nodeColor={(n) => ROLE_COLOR[(n.data as FraxNodeData).node.role]}
            className="!bottom-3 !right-3"
          />
        ) : null}
      </ReactFlow>
      <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-border bg-surface/90 px-2.5 py-1.5">
        <p className="text-[9px] font-medium uppercase tracking-[0.08em] text-ink-3">Legend</p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-[9.5px] text-ink-2">
          <span className="flex items-center gap-1">
            <span className="h-px w-4 bg-[var(--graph-edge-active,var(--accent))]" /> transfer
          </span>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full" style={{ background: ROLE_COLOR.focus }} /> focus
          </span>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full" style={{ background: ROLE_COLOR.suspect }} /> suspect
          </span>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full" style={{ background: ROLE_COLOR.counterparty }} /> counterparty
          </span>
        </div>
      </div>
    </div>
  );
}
