"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { TopNav } from "./TopNav";
import { type ReactNode } from "react";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <TopNav />
        <main className="flex flex-1 flex-col gap-4 p-4">{children}</main>
      </SidebarInset>

      {/* Viewport-Aware Chatbot placeholder — Phase 6 */}
      <div
        aria-label="Agentic chatbot (coming soon)"
        className="pointer-events-none fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-primary/40 bg-background/80 text-primary/40 shadow-lg backdrop-blur-sm"
      >
        <span className="text-xs font-bold">AI</span>
      </div>
    </SidebarProvider>
  );
}
