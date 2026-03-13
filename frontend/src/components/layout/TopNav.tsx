"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import { useAuthStore, type UserRole } from "@/store/useAuthStore";

const ROLES: UserRole[] = ["Professor", "TA", "Student"];

export function TopNav() {
  const user = useAuthStore((s) => s.user);
  const setRole = useAuthStore((s) => s.setRole);

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />

      <div className="flex flex-1 items-center justify-end gap-3">
        {user && (
          <>
            <span className="text-muted-foreground text-sm">{user.name}</span>

            {/* Dev-only role switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {user.role}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
                  Dev — switch role
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ROLES.map((role) => (
                  <DropdownMenuItem
                    key={role}
                    onClick={() => setRole(role)}
                    className={user.role === role ? "font-semibold" : ""}
                  >
                    {role}
                    {user.role === role && (
                      <span className="text-muted-foreground ml-auto text-xs">active</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </header>
  );
}
