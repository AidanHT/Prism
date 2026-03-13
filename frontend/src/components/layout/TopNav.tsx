"use client";

import Link from "next/link";
import { Bell, ChevronDown } from "lucide-react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore, type UserRole } from "@/store/useAuthStore";
import { useNotificationStore } from "@/store/useNotificationStore";

const ROLES: UserRole[] = ["Professor", "TA", "Student"];

export function TopNav() {
  const user = useAuthStore((s) => s.user);
  const setRole = useAuthStore((s) => s.setRole);
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />

      <div className="flex flex-1 items-center justify-end gap-3">
        {user && (
          <>
            <span className="text-muted-foreground text-sm">{user.name}</span>

            {/* Notification bell */}
            <Link
              href="/notifications"
              aria-label={
                unreadCount > 0
                  ? `${unreadCount} unread notifications`
                  : "Notifications"
              }
              className="relative inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted transition-colors"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] leading-none flex items-center justify-center"
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Badge>
              )}
            </Link>

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
