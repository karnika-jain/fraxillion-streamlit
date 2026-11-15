"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  ArrowRight,
  Building2,
  FileText,
  Fingerprint,
  LayoutDashboard,
  Moon,
  Search,
  Siren,
  Sun,
  UserRound,
} from "lucide-react";
import { api } from "@/lib/api";
import { ROLE_ACTOR, useUIStore, useSessionStore } from "@/stores";
import { useTheme } from "@/components/theme-provider";
import { SEGMENTS } from "@/lib/navigation";
import { ROLE_LABEL } from "@/lib/utils";
import type { Role, SearchResult } from "@/types";
import { Badge } from "@/components/ui/badge";

const TYPE_ICON = {
  case: FileText,
  account: Building2,
  hash: Fingerprint,
  alert: Siren,
} as const;

const ROLES: Role[] = ["investigator", "lead", "compliance"];

export function CommandPalette() {
  const router = useRouter();
  const open = useUIStore((s) => s.commandOpen);
  const setOpen = useUIStore((s) => s.setCommandOpen);
  const { theme, toggle } = useTheme();
  const setRole = useSessionStore((s) => s.setRole);
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen(!useUIStore.getState().commandOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  React.useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const found = await api.search(query);
        if (!cancelled) setResults(found);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 130);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Global search and commands"
      className="fixed left-1/2 top-[12vh] z-[60] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
      shouldFilter={false}
    >
      <div className="flex items-center gap-2.5 border-b border-border px-4">
        <Search className="size-4 shrink-0 text-ink-3" />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Search case IDs, accounts, alert IDs or SHA-256 hashes…"
          className="h-12 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
        />
        <Badge tone="neutral" size="sm">esc</Badge>
      </div>
      <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto p-2">
        <Command.Empty className="px-4 py-8 text-center text-[12px] text-ink-3">
          {loading ? "Searching SQLite…" : "No match. Try a case ID, account ID or hash prefix."}
        </Command.Empty>

        {query.trim() === "" ? (
          <>
            <Command.Group
              heading="Go to"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.09em] [&_[cmdk-group-heading]]:text-ink-3"
            >
              <Command.Item
                value="overview dashboard"
                onSelect={() => go("/app")}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-ink-2 data-[selected=true]:bg-surface-3 data-[selected=true]:text-ink"
              >
                <LayoutDashboard className="size-4 text-ink-3" /> Overview
                <ArrowRight className="ml-auto size-3 text-ink-3" />
              </Command.Item>
              {SEGMENTS.filter((s) => s.href !== "/app").map((s) => (
                <Command.Item
                  key={s.href}
                  value={s.label}
                  onSelect={() => go(s.href)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-ink-2 data-[selected=true]:bg-surface-3 data-[selected=true]:text-ink"
                >
                  <s.icon className="size-4 text-ink-3" />
                  {s.label}
                  <span className="ml-auto font-mono text-[10px] text-ink-3">{s.short}</span>
                </Command.Item>
              ))}
            </Command.Group>
            <Command.Separator className="my-1 h-px bg-border" />
            <Command.Group
              heading="Actions"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.09em] [&_[cmdk-group-heading]]:text-ink-3"
            >
              <Command.Item
                value="toggle theme"
                onSelect={() => {
                  toggle();
                  setOpen(false);
                }}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-ink-2 data-[selected=true]:bg-surface-3 data-[selected=true]:text-ink"
              >
                {theme === "dark" ? <Sun className="size-4 text-ink-3" /> : <Moon className="size-4 text-ink-3" />}
                Switch to {theme === "dark" ? "light" : "dark"} theme
              </Command.Item>
              {ROLES.map((role) => (
                <Command.Item
                  key={role}
                  value={`role ${role}`}
                  onSelect={() => {
                    setRole(role);
                    setOpen(false);
                  }}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-ink-2 data-[selected=true]:bg-surface-3 data-[selected=true]:text-ink"
                >
                  <UserRound className="size-4 text-ink-3" />
                  Act as {ROLE_LABEL[role].toLowerCase()} · {ROLE_ACTOR[role]}
                </Command.Item>
              ))}
            </Command.Group>
          </>
        ) : (
          <Command.Group
            heading={`${results.length} result${results.length === 1 ? "" : "s"}`}
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.09em] [&_[cmdk-group-heading]]:text-ink-3"
          >
            {results.map((r) => {
              const Icon = TYPE_ICON[r.type];
              return (
                <Command.Item
                  key={`${r.type}-${r.id}`}
                  value={`${r.label} ${r.sublabel}`}
                  onSelect={() => go(r.href)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-ink-2 data-[selected=true]:bg-surface-3 data-[selected=true]:text-ink"
                >
                  <Icon className="size-4 shrink-0 text-ink-3" />
                  <span className="min-w-0">
                    <span className="block truncate font-mono text-[11.5px] text-ink">{r.label}</span>
                    <span className="block truncate text-[11px] text-ink-3">{r.sublabel}</span>
                  </span>
                  <Badge tone="outline" size="sm" className="ml-auto shrink-0">
                    {r.type}
                  </Badge>
                </Command.Item>
              );
            })}
          </Command.Group>
        )}
      </Command.List>
      <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[10px] text-ink-3">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1"><Badge tone="outline" size="sm">↑↓</Badge> navigate</span>
          <span className="flex items-center gap-1"><Badge tone="outline" size="sm">↵</Badge> open</span>
        </span>
        <span>Live SQLite search</span>
      </div>
    </Command.Dialog>
  );
}
