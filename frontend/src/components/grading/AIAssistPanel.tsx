"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bot, Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import { gradingApi, rubricApi } from "@/lib/api";
import { useApiOpts } from "@/hooks/useApiOpts";
import type { EvaluateResponse, RubricResponse } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AIAssistPanelProps {
  courseId: string;
  /** UUID of the student's submission — undefined when no submission exists. */
  submissionId: string | undefined;
  /** Called when the grader accepts the AI suggestion in full. */
  onAccept: (score: number, feedbackText: string) => void;
  /** Called when the grader wants to edit the AI feedback before saving. */
  onEdit: (feedbackText: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AIAssistPanel({
  courseId,
  submissionId,
  onAccept,
  onEdit,
}: AIAssistPanelProps) {
  const opts = useApiOpts();
  const [selectedRubricId, setSelectedRubricId] = useState("");
  const [suggestion, setSuggestion] = useState<EvaluateResponse | null>(null);

  // Fetch rubrics for the current course so the grader can pick one.
  const { data: rubrics = [], isLoading: rubricsLoading } = useQuery({
    queryKey: ["rubrics", courseId],
    queryFn: () => rubricApi.list(courseId, opts),
    enabled: !!opts.userId,
    staleTime: 60_000,
  });

  const selectedRubric: RubricResponse | undefined = rubrics.find(
    (r) => r.id === selectedRubricId,
  );

  // Evaluate mutation — calls the grading pipeline on the backend.
  const evaluate = useMutation({
    mutationFn: () =>
      gradingApi.evaluate(
        { submission_id: submissionId!, rubric_id: selectedRubricId },
        opts,
      ),
    onSuccess: (data) => setSuggestion(data),
    onError: () => toast.error("AI evaluation failed. Check that the backend is running."),
  });

  function handleReject() {
    setSuggestion(null);
  }

  // ── No submission guard ────────────────────────────────────────────────────

  if (!submissionId) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Bot className="h-4 w-4 text-muted-foreground" />
            AI Co-Pilot
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            No submission available — AI evaluation requires a student submission.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Bot className="h-4 w-4 text-muted-foreground" />
          AI Co-Pilot
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* ── Rubric selector + trigger (hidden once a suggestion is shown) ── */}
        {!suggestion && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Rubric</Label>
              {rubricsLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : rubrics.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No rubrics found for this course. Generate one first.
                </p>
              ) : (
                <select
                  value={selectedRubricId}
                  onChange={(e) => setSelectedRubricId(e.target.value)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select a rubric…</option>
                  {rubrics.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <Button
              className="w-full"
              variant="secondary"
              disabled={!selectedRubricId || evaluate.isPending}
              onClick={() => evaluate.mutate()}
            >
              <Bot className="mr-2 h-4 w-4" />
              {evaluate.isPending ? "Evaluating…" : "AI Assist"}
            </Button>
          </>
        )}

        {/* ── Loading skeleton ─────────────────────────────────────────────── */}
        {evaluate.isPending && (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        )}

        {/* ── AI Suggestion card ───────────────────────────────────────────── */}
        {suggestion && !evaluate.isPending && (
          <div className="space-y-3">
            {/* Suggested total score */}
            <div className="rounded-lg bg-muted/50 px-4 py-3 text-center">
              <p className="mb-0.5 text-xs text-muted-foreground">Suggested Score</p>
              <p className="text-3xl font-bold tabular-nums">
                {suggestion.evaluation.suggested_total_score}
              </p>
            </div>

            {/* Criterion breakdown mini-table */}
            {selectedRubric && (
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Criterion Breakdown
                </p>
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full text-sm">
                    <tbody>
                      {suggestion.evaluation.criterion_breakdown.map((cs) => {
                        const criterion = selectedRubric.criteria.find(
                          (c) => c.id === cs.criterion_id,
                        );
                        // Identify the rating cell the AI selected (closest points match).
                        const aiRating = criterion?.ratings.reduce((prev, cur) =>
                          Math.abs(cur.points - cs.score) <
                          Math.abs(prev.points - cs.score)
                            ? cur
                            : prev,
                        );
                        return (
                          <tr
                            key={cs.criterion_id}
                            className="border-b last:border-0"
                          >
                            <td className="px-3 py-2 text-xs text-muted-foreground leading-snug">
                              {criterion?.description ?? cs.criterion_id}
                              {aiRating && (
                                <span className="block text-[10px] text-muted-foreground/70">
                                  {aiRating.description}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-xs font-medium",
                                  cs.score === criterion?.points
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                    : cs.score === 0
                                      ? "bg-destructive/10 text-destructive"
                                      : "bg-primary/10 text-primary",
                                )}
                              >
                                {cs.score} / {criterion?.points ?? "?"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Constructive feedback paragraph */}
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Suggested Feedback
              </p>
              <p className="rounded-lg border bg-muted/20 px-3 py-2 text-sm leading-relaxed">
                {suggestion.evaluation.constructive_feedback}
              </p>
            </div>

            {/* Human-in-the-loop action buttons */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                size="sm"
                className="w-full"
                onClick={() => {
                  onAccept(
                    suggestion.evaluation.suggested_total_score,
                    suggestion.evaluation.constructive_feedback,
                  );
                  setSuggestion(null);
                }}
              >
                <Check className="mr-1 h-3.5 w-3.5" />
                Accept
              </Button>

              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => {
                  onEdit(suggestion.evaluation.constructive_feedback);
                  setSuggestion(null);
                }}
              >
                <Pencil className="mr-1 h-3.5 w-3.5" />
                Edit
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={handleReject}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Reject
              </Button>
            </div>

            {/* Let the grader run another evaluation */}
            <button
              type="button"
              className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setSuggestion(null)}
            >
              ← Back to rubric selector
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
