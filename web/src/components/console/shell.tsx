"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/console/sidebar";
import { TopBar } from "@/components/console/topbar";
import { CommandPalette } from "@/components/console/command-palette";
import { WorkflowGuide } from "@/components/console/workflow-guide";
import { useUIStore } from "@/stores";
import { cn } from "@/lib/utils";

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-dvh bg-bg">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div
        className={cn(
          "flex min-h-dvh flex-col transition-[padding-left] duration-200 ease-out",
          collapsed ? "lg:pl-[68px]" : "lg:pl-[248px]",
        )}
      >
        <TopBar onOpenMobileNav={() => setMobileOpen(true)} />
        <main id="main" className="flex-1">
          <div
            key={pathname}
            className="mx-auto w-full max-w-[1560px] animate-[fade-up_180ms_ease-out] px-4 py-5 md:px-6 md:py-6"
          >
            <WorkflowGuide />
            {children}
          </div>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
