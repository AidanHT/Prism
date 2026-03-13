"use client";

/**
 * Dashboard-level error boundary.
 *
 * Catches any unhandled render errors thrown by pages or components within the
 * (dashboard) route group.  Surfaces a minimal, branded recovery UI instead
 * of a blank white screen.  Uses shadcn/ui primitives so it renders correctly
 * even when global CSS is loaded.
 */

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the full error in development for fast debugging.
    console.error("[Dashboard Error Boundary]", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-md border-destructive/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Something went wrong
          </CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            An unexpected error occurred while rendering this page. Your work
            has not been lost — try refreshing to recover.
          </p>

          {/* Show the raw message in dev mode only */}
          {process.env.NODE_ENV === "development" && error.message && (
            <pre className="max-h-32 overflow-auto rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              {error.message}
              {error.digest ? `\n\ndigest: ${error.digest}` : ""}
            </pre>
          )}
        </CardContent>

        <CardFooter>
          <Button
            size="sm"
            className="w-full gap-2"
            onClick={reset}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
