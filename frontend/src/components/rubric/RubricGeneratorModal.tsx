"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";

import { rubricApi, type ApiOptions } from "@/lib/api";
import type { CalibrationWarning, GeneratedCriterion } from "@/lib/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  courseId: string;
  assignmentTitle: string;
  /** Plain-text or HTML assignment instructions passed to the AI. */
  assignmentInstructions: string;
  /** Called when the professor finalises the rubric. */
  onApply: (criteria: GeneratedCriterion[]) => void;
  opts: ApiOptions;
}

type ModalState =
  | { phase: "generating" }
  | { phase: "preview"; rubricId: string; criteria: GeneratedCriterion[] }
  | {
      phase: "calibrate";
      rubricId: string;
      criteria: GeneratedCriterion[];
      warnings: CalibrationWarning[];
      calibrating: boolean;
    };

// ── Component ─────────────────────────────────────────────────────────────────

export function RubricGeneratorModal({
  open,
  onClose,
  courseId,
  assignmentTitle,
  assignmentInstructions,
  onApply,
  opts,
}: Props) {
  const [state, setState] = useState<ModalState>({ phase: "generating" });
  const [error, setError] = useState<string | null>(null);
  const [sampleFiles, setSampleFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-generate when the modal opens.
  useEffect(() => {
    if (!open) return;
    setState({ phase: "generating" });
    setError(null);
    setSampleFiles([]);

    rubricApi
      .generate(
        {
          course_id: courseId,
          assignment_title: assignmentTitle || "Untitled Assignment",
          assignment_instructions:
            assignmentInstructions || assignmentTitle || "No instructions provided.",
        },
        opts,
      )
      .then((res) => {
        setState({
          phase: "preview",
          rubricId: res.rubric_id,
          criteria: res.criteria,
        });
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : "Failed to generate rubric.",
        );
        setState({ phase: "preview", rubricId: "", criteria: [] });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Criterion editing helpers ──────────────────────────────────────────────

  function updateCriterionDescription(idx: number, value: string) {
    if (state.phase !== "preview" && state.phase !== "calibrate") return;
    const next = state.criteria.map((c, i) =>
      i === idx ? { ...c, description: value } : c,
    );
    setState({ ...state, criteria: next });
  }

  function updateCriterionPoints(idx: number, value: number) {
    if (state.phase !== "preview" && state.phase !== "calibrate") return;
    const next = state.criteria.map((c, i) =>
      i === idx ? { ...c, points: value } : c,
    );
    setState({ ...state, criteria: next });
  }

  function removeCriterion(idx: number) {
    if (state.phase !== "preview" && state.phase !== "calibrate") return;
    setState({ ...state, criteria: state.criteria.filter((_, i) => i !== idx) });
  }

  // ── File handling ──────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    setSampleFiles((prev) => {
      const combined = [...prev, ...picked].slice(0, 3);
      return combined;
    });
    // Reset so the same file can be re-selected after removal.
    e.target.value = "";
  }

  function removeFile(idx: number) {
    setSampleFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  function handleApply() {
    if (state.phase === "preview" || state.phase === "calibrate") {
      onApply(state.criteria);
      onClose();
    }
  }

  async function handleCalibrate() {
    if (state.phase !== "calibrate") return;
    setState({ ...state, calibrating: true });
    try {
      const res = await rubricApi.calibrate(state.rubricId, sampleFiles, opts);
      setState({
        ...state,
        calibrating: false,
        warnings: res.calibration_warnings,
      });
    } catch (err) {
      setState({ ...state, calibrating: false });
      setError(
        err instanceof Error ? err.message : "Calibration failed.",
      );
    }
  }

  function goToCalibrate() {
    if (state.phase !== "preview") return;
    setState({
      phase: "calibrate",
      rubricId: state.rubricId,
      criteria: state.criteria,
      warnings: [],
      calibrating: false,
    });
  }

  function goToPreview() {
    if (state.phase !== "calibrate") return;
    setState({
      phase: "preview",
      rubricId: state.rubricId,
      criteria: state.criteria,
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isGenerating = state.phase === "generating";
  const criteria =
    state.phase === "preview" || state.phase === "calibrate"
      ? state.criteria
      : [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Generate Rubric with AI</span>
            {state.phase === "calibrate" && (
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                Step 2 of 2 – Calibration
              </span>
            )}
            {state.phase === "preview" && (
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                Step 1 of 2 – Review
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* ── Generating state ─────────────────────────────────── */}
        {isGenerating && (
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Generating rubric with Claude Opus…</p>
          </div>
        )}

        {/* ── Error banner ─────────────────────────────────────── */}
        {error && (
          <Alert variant="destructive" className="mt-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* ── Step 1 – Preview & edit generated criteria ───────── */}
        {(state.phase === "preview" || state.phase === "calibrate") &&
          state.phase === "preview" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Review the AI-generated criteria below. Edit descriptions and
                point values before calibrating or applying.
              </p>
              <CriteriaEditor
                criteria={criteria}
                onUpdateDescription={updateCriterionDescription}
                onUpdatePoints={updateCriterionPoints}
                onRemove={removeCriterion}
              />
            </div>
          )}

        {/* ── Step 2 – Calibration ─────────────────────────────── */}
        {state.phase === "calibrate" && (
          <div className="space-y-4">
            {/* Compact criteria summary */}
            <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Rubric criteria
              </p>
              {state.criteria.map((c, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-2 text-sm"
                >
                  <span className="text-foreground">{c.description}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {c.points} pts
                  </span>
                </div>
              ))}
            </div>

            {/* File upload */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Upload sample submissions</p>
              <p className="text-xs text-muted-foreground">
                Upload 2–3 representative student papers (PDF or TXT). The AI
                will apply the rubric and flag ambiguous criteria.
              </p>

              <div className="flex flex-wrap gap-2">
                {sampleFiles.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs"
                  >
                    <span className="max-w-[140px] truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}

                {sampleFiles.length < 3 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-md border border-dashed px-3 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <Upload className="h-3 w-3" />
                    Add file
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.txt,.md"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            {/* Calibration warnings */}
            {state.warnings.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Calibration warnings ({state.warnings.length})
                </p>
                {state.warnings.map((w, i) => (
                  <Alert key={i} variant="warning">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="text-xs font-medium">
                      {w.criterion_description}
                      {w.variance_pct != null && (
                        <span className="ml-2 font-normal text-muted-foreground">
                          ~{w.variance_pct.toFixed(0)}% variance
                        </span>
                      )}
                    </AlertTitle>
                    <AlertDescription className="text-xs">
                      {w.warning_message}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {state.warnings.length === 0 &&
              !state.calibrating &&
              sampleFiles.length >= 2 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <AlertDescription className="text-xs text-muted-foreground">
                    Run calibration to check for ambiguous criteria.
                  </AlertDescription>
                </Alert>
              )}
          </div>
        )}

        {/* ── Footer ───────────────────────────────────────────── */}
        {!isGenerating && (
          <DialogFooter className="gap-2">
            {state.phase === "preview" && (
              <>
                <Button variant="outline" size="sm" onClick={handleApply}>
                  Apply directly
                </Button>
                <Button
                  size="sm"
                  onClick={goToCalibrate}
                  disabled={criteria.length === 0}
                >
                  Calibrate rubric
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </>
            )}

            {state.phase === "calibrate" && (
              <>
                <Button variant="ghost" size="sm" onClick={goToPreview}>
                  ← Edit rubric
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCalibrate}
                  disabled={sampleFiles.length < 2 || state.calibrating}
                >
                  {state.calibrating ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Calibrating…
                    </>
                  ) : (
                    "Run calibration"
                  )}
                </Button>
                <Button size="sm" onClick={handleApply}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Apply rubric
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── CriteriaEditor ────────────────────────────────────────────────────────────

function CriteriaEditor({
  criteria,
  onUpdateDescription,
  onUpdatePoints,
  onRemove,
}: {
  criteria: GeneratedCriterion[];
  onUpdateDescription: (idx: number, value: string) => void;
  onUpdatePoints: (idx: number, value: number) => void;
  onRemove: (idx: number) => void;
}) {
  if (criteria.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No criteria generated. Try adjusting the assignment instructions.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {criteria.map((c, i) => (
        <div
          key={i}
          className="rounded-lg border bg-muted/20 p-3 space-y-2"
        >
          <div className="flex items-start gap-2">
            <Input
              value={c.description}
              onChange={(e) => onUpdateDescription(i, e.target.value)}
              placeholder={`Criterion ${i + 1}`}
              className="text-sm h-8"
            />
            <div className="flex items-center gap-1 shrink-0">
              <Input
                type="number"
                min={0}
                value={c.points}
                onChange={(e) => onUpdatePoints(i, Number(e.target.value))}
                className="w-16 h-8 text-xs"
              />
              <span className="text-xs text-muted-foreground">pts</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(i)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Rating level chips (read-only) */}
          <div className="flex flex-wrap gap-1.5">
            {c.ratings.map((r, ri) => (
              <span
                key={ri}
                className="rounded-full border bg-background px-2.5 py-0.5 text-xs text-muted-foreground"
              >
                {r.description} · {r.points}pts
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
