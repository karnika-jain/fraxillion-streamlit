"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role } from "@/types";

interface UIState {
  sidebarCollapsed: boolean;
  density: "compact" | "comfortable";
  commandOpen: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebar: () => void;
  setDensity: (v: "compact" | "comfortable") => void;
  setCommandOpen: (v: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      density: "comfortable",
      commandOpen: false,
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setDensity: (v) => set({ density: v }),
      setCommandOpen: (v) => set({ commandOpen: v }),
    }),
    {
      name: "fraxillion-ui",
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        density: s.density,
      }),
    },
  ),
);

/**
 * The console has no authentication. The acting role only changes the display
 * name that is written into maker/checker fields, which is enough to exercise
 * the real maker != checker rule in core.workflow.
 */
interface SessionState {
  role: Role;
  actor: string;
  setRole: (role: Role) => void;
  setActor: (actor: string) => void;
}

export const ROLE_ACTOR: Record<Role, string> = {
  investigator: "A. Sharma",
  lead: "P. Krishnan",
  compliance: "N. Verma",
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      role: "investigator",
      actor: ROLE_ACTOR.investigator,
      setRole: (role) => set({ role, actor: ROLE_ACTOR[role] }),
      setActor: (actor) => set({ actor }),
    }),
    {
      name: "fraxillion-session",
      partialize: (s) => ({ role: s.role, actor: s.actor }),
    },
  ),
);
