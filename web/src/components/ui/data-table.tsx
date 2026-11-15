"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  type ColumnPinningState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3, Download, RotateCcw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/misc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/overlays";

function downloadCsv<T>(rows: T[], columns: ColumnDef<T>[], filename: string) {
  const cols = columns.filter((c) => c.id || (c as { accessorKey?: string }).accessorKey);
  const header = cols.map((c) => String(c.header ?? c.id ?? (c as { accessorKey?: string }).accessorKey ?? ""));
  const lines = rows.map((row) =>
    cols
      .map((c) => {
        const key = (c as { accessorKey?: string }).accessorKey;
        const value = key ? (row as Record<string, unknown>)[key] : "";
        const s = value == null ? "" : String(value);
        return `"${s.replaceAll('"', '""')}"`;
      })
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function DataTable<T>({
  data,
  columns,
  emptyTitle = "No records",
  emptyDescription,
  initialSorting = [],
  initialPinning,
  savedViewKey,
  searchPlaceholder = "Filter rows…",
  onRowClick,
  rowHeight,
  toolbar,
  className,
  maxHeight = 560,
  getRowId,
}: {
  data: T[];
  columns: ColumnDef<T>[];
  emptyTitle?: string;
  emptyDescription?: string;
  initialSorting?: SortingState;
  initialPinning?: ColumnPinningState;
  savedViewKey?: string;
  searchPlaceholder?: string;
  onRowClick?: (row: T) => void;
  rowHeight?: number;
  toolbar?: React.ReactNode;
  className?: string;
  maxHeight?: number;
  getRowId?: (row: T) => string;
}) {
  const density = useUIStore((s) => s.density);
  const setDensity = useUIStore((s) => s.setDensity);
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnPinning, setColumnPinning] = React.useState<ColumnPinningState>(initialPinning ?? {});
  const [restored, setRestored] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!savedViewKey) return;
    try {
      const raw = localStorage.getItem(`fraxillion-table:${savedViewKey}`);
      if (raw) {
        const saved = JSON.parse(raw) as {
          sorting?: SortingState;
          columnFilters?: ColumnFiltersState;
          columnPinning?: ColumnPinningState;
          columnVisibility?: VisibilityState;
        };
        if (saved.sorting) setSorting(saved.sorting);
        if (saved.columnFilters) setColumnFilters(saved.columnFilters);
        if (saved.columnPinning) setColumnPinning(saved.columnPinning);
        if (saved.columnVisibility) setColumnVisibility(saved.columnVisibility);
      }
    } catch {
      // Saved views are a convenience; a corrupt value must not block the table.
    } finally {
      setRestored(true);
    }
  }, [savedViewKey]);

  React.useEffect(() => {
    if (!savedViewKey || !restored) return;
    try {
      localStorage.setItem(
        `fraxillion-table:${savedViewKey}`,
        JSON.stringify({ sorting, columnFilters, columnPinning, columnVisibility }),
      );
    } catch {
      // Ignore quota/private-mode failures.
    }
  }, [savedViewKey, restored, sorting, columnFilters, columnPinning, columnVisibility]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnFilters, columnVisibility, columnPinning },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnPinningChange: setColumnPinning,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getRowId,
    globalFilterFn: "includesString",
  });

  const rows = table.getRowModel().rows;
  const height = rowHeight ?? (density === "compact" ? 36 : 44);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => height,
    overscan: 12,
  });
  const virtualRows = virtualizer.getVirtualItems();
  const paddingTop = virtualRows[0]?.start ?? 0;
  const paddingBottom = Math.max(0, virtualizer.getTotalSize() - (virtualRows.at(-1)?.end ?? 0));

  return (
    <div className={cn("console-panel overflow-hidden", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <div className="relative min-w-[180px] flex-1 sm:max-w-[280px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-3" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 border-border bg-surface pl-8 text-[12px]"
            aria-label="Filter table rows"
          />
        </div>
        {toolbar}
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setDensity(density === "compact" ? "comfortable" : "compact")}
            aria-label={`Switch to ${density === "compact" ? "comfortable" : "compact"} row density`}
            title="Row density"
          >
            <Columns3 className="size-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Choose visible columns">
                <Columns3 className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <p className="px-2.5 py-2 text-[10px] uppercase tracking-[0.08em] text-ink-3">Columns</p>
              {table.getAllLeafColumns().map((col) => (
                <label
                  key={col.id}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2.5 py-1.5 text-[12px] text-ink-2 hover:bg-surface-3"
                >
                  <input
                    type="checkbox"
                    checked={col.getIsVisible()}
                    onChange={col.getToggleVisibilityHandler()}
                    className="accent-[var(--accent)]"
                  />
                  {typeof col.columnDef.header === "string" ? col.columnDef.header : col.id}
                </label>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              setGlobalFilter("");
              setColumnFilters([]);
              setSorting(initialSorting);
              setColumnVisibility({});
              setColumnPinning(initialPinning ?? {});
            }}
            aria-label="Reset table view"
            title="Reset view"
          >
            <RotateCcw className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() =>
              downloadCsv(
                rows.map((r) => r.original),
                columns,
                `${savedViewKey ?? "export"}.csv`,
              )
            }
            aria-label="Export visible rows to CSV"
            title="Export CSV"
          >
            <Download className="size-3.5" />
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="scrollbar-thin overflow-auto" style={{ maxHeight }}>
        <table className="w-full border-separate border-spacing-0 text-left text-[12px]">
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const pinned = header.column.getIsPinned();
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      style={{
                        width: header.getSize() === 150 ? undefined : header.getSize(),
                        left: pinned === "left" ? header.column.getStart("left") : undefined,
                        right: pinned === "right" ? header.column.getAfter("right") : undefined,
                      }}
                      className={cn(
                        "h-9 whitespace-nowrap border-b border-border bg-surface-2 px-3 text-[10px] font-semibold uppercase tracking-[0.07em] text-ink-3",
                        pinned && "sticky z-20",
                        pinned && "shadow-[2px_0_0_var(--border)]",
                      )}
                    >
                      {header.isPlaceholder ? null : (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            header.column.getCanSort() && "hover:text-ink",
                          )}
                          aria-label={`Sort by ${String(header.column.columnDef.header ?? header.id)}`}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() ? (
                            header.column.getIsSorted() === "asc" ? (
                              <ArrowUp className="size-3 text-accent" />
                            ) : header.column.getIsSorted() === "desc" ? (
                              <ArrowDown className="size-3 text-accent" />
                            ) : (
                              <ChevronsUpDown className="size-3 opacity-40" />
                            )
                          ) : null}
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {paddingTop > 0 ? (
              <tr aria-hidden>
                <td colSpan={table.getVisibleLeafColumns().length} style={{ height: paddingTop }} />
              </tr>
            ) : null}
            {virtualRows.map((vr) => {
              const row = rows[vr.index];
              if (!row) return null;
              return (
                <tr
                  key={row.id}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={() => onRowClick?.(row.original)}
                  onKeyDown={(e) => {
                    if (onRowClick && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onRowClick(row.original);
                    }
                  }}
                  className={cn(
                    "table-row-hover transition-colors",
                    onRowClick && "cursor-pointer focus-visible:bg-surface-3 focus-visible:outline-none",
                  )}
                  style={{ height }}
                >
                  {row.getVisibleCells().map((cell) => {
                    const pinned = cell.column.getIsPinned();
                    return (
                      <td
                        key={cell.id}
                        style={{
                          left: pinned === "left" ? cell.column.getStart("left") : undefined,
                          right: pinned === "right" ? cell.column.getAfter("right") : undefined,
                        }}
                        className={cn(
                          "border-b border-border/70 px-3 align-middle",
                          pinned && "sticky z-[5] bg-surface",
                          pinned && "shadow-[2px_0_0_var(--border)]",
                          cell.column.id === "amount" && "text-right font-mono tabular-nums",
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {paddingBottom > 0 ? (
              <tr aria-hidden>
                <td colSpan={table.getVisibleLeafColumns().length} style={{ height: paddingBottom }} />
              </tr>
            ) : null}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        ) : null}
      </div>
      <div className="flex items-center justify-between border-t border-border bg-surface-2 px-3 py-1.5 text-[10px] text-ink-3">
        <span>
          {rows.length.toLocaleString("en-IN")} of {data.length.toLocaleString("en-IN")} rows
        </span>
        <span className="font-mono">virtualised · saved view {savedViewKey ? "on" : "off"}</span>
      </div>
    </div>
  );
}
