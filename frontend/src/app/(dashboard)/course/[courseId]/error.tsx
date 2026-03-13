"use client";

/**
 * Course-level error boundary.
 *
 * Catches render errors thrown by any page within /course/[courseId]/.
 * Shown inside the CourseShell chrome (sidebar + header are still visible),
 * so instructors can navigate away to another section without a full reload.
 */

import { useEffect } from "react";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function CoursePageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("[Course Page Error Boundary]", error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-md border-destructive/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Page failed to load
          </CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            This page encountered an error. You can try again or navigate to
            another section using the sidebar.
          </p>

          {process.env.NODE_ENV === "development" && error.message && (
            <pre className="max-h-36 overflow-auto rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              {error.message}
              {error.digest ? `\n\ndigest: ${error.digest}` : ""}
            </pre>
          )}
        </CardContent>

        <CardFooter className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-2"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Go back
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-2"
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
