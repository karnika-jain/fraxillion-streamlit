import type { Metadata } from "next";
import { ConsoleShell } from "@/components/console/shell";

export const metadata: Metadata = {
  title: "Console",
  description: "Fraxillion investigation console.",
};

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return <ConsoleShell>{children}</ConsoleShell>;
}
