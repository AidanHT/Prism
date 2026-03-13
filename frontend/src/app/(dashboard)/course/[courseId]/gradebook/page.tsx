"use client";

import { useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowUpDown, TableProperties } from "lucide-react";
import { toast } from "sonner";

import { courseApi, gradeApi } from "@/lib/api";
import type { GradebookStudentRow, GradebookGradeEntry } from "@/lib/types";
import { useApiOpts } from "@/hooks/useApiOpts";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface EditCell {
  studentId: string;
  gradeId: string;
  value: string;
}

export default function GradebookPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const opts = useApiOpts();
  const qc = useQueryClient();

  const [sortAsc, setSortAsc] = useState(true);
  const [editCell, setEditCell] = useState<EditCell | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["gradebook", courseId],
    queryFn: () => courseApi.gradebook(courseId, opts),
    enabled: !!opts.userId,
    staleTime: 30_000,
  });

  const updateGrade = useMutation({
    mutationFn: ({ gradeId, score }: { gradeId: string; score: number }) =>
      gradeApi.update(gradeId, { score }, opts),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["gradebook", courseId] });
      toast.success("Grade updated");
    },
    onError: () => toast.error("Failed to update grade"),
  });

  const commitEdit = useCallback(() => {
    if (!editCell) return;
    const score = parseFloat(editCell.value);
    if (!isNaN(score) && score >= 0) {
      updateGrade.mutate({ gradeId: editCell.gradeId, score });
    }
    setEditCell(null);
  }, [editCell, updateGrade]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-destructive">
          Failed to load gradebook. Ensure the backend is running and your User
          ID is set to a seeded UUID.
        </p>
      </div>
    );
  }

  // Sort students by name
  const students: GradebookStudentRow[] = [...data.students].sort((a, b) =>
    sortAsc
      ? a.student_name.localeCompare(b.student_name)
      : b.student_name.localeCompare(a.student_name),
  );

  // Build grade lookup: student_id → assignment_id → GradebookGradeEntry
  const gradeMap = new Map<string, Map<string, GradebookGradeEntry>>();
  for (const row of students) {
    const m = new Map<string, GradebookGradeEntry>();
    for (const g of row.grades) {
      if (g.assignment_id) m.set(g.assignment_id, g);
    }
    gradeMap.set(row.student_id, m);
  }

  // Compute per-student totals
  function studentTotal(row: GradebookStudentRow): { earned: number; max: number } {
    const earned = row.grades.reduce((s, g) => s + g.score, 0);
    const max = row.grades.reduce((s, g) => s + g.max_score, 0);
    return { earned, max };
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`/course/${courseId}`}>Course</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Gradebook</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TableProperties className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Gradebook</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Click any score cell to edit inline
        </p>
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50">
              {/* Sticky student name column */}
              <th className="sticky left-0 z-10 bg-muted/50 px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap border-r min-w-[180px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium text-muted-foreground hover:text-foreground gap-1"
                  onClick={() => setSortAsc((p) => !p)}
                >
                  Student
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </Button>
              </th>

              {/* Assignment columns */}
              {data.assignments.map((a) => (
                <th
                  key={a.id}
                  className="px-3 py-3 text-left font-medium text-muted-foreground whitespace-nowrap min-w-[130px] border-r last:border-r-0"
                >
                  <div className="truncate max-w-[120px]" title={a.title}>
                    {a.title}
                  </div>
                  <div className="text-[10px] font-normal opacity-70 mt-0.5">
                    /{a.points_possible}
                  </div>
                </th>
              ))}

              {/* Total */}
              <th className="px-3 py-3 text-left font-medium text-muted-foreground whitespace-nowrap min-w-[80px]">
                Total
              </th>
            </tr>
          </thead>

          <tbody>
            {students.map((row, ri) => {
              const studentGrades = gradeMap.get(row.student_id);
              const { earned, max } = studentTotal(row);
              const pct = max > 0 ? Math.round((earned / max) * 100) : 0;

              return (
                <tr
                  key={row.student_id}
                  className={cn(
                    "border-t hover:bg-muted/30 transition-colors",
                    ri % 2 === 0 ? "bg-background" : "bg-muted/10",
                  )}
                >
                  {/* Student name cell — sticky */}
                  <td className="sticky left-0 z-10 px-4 py-2.5 border-r bg-inherit">
                    <div className="font-medium truncate max-w-[165px]" title={row.student_name}>
                      {row.student_name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate max-w-[165px]">
                      {row.student_email}
                    </div>
                  </td>

                  {/* Score cells */}
                  {data.assignments.map((a) => {
                    const entry = studentGrades?.get(a.id);
                    const isEditing =
                      editCell?.studentId === row.student_id &&
                      editCell?.gradeId === (entry?.grade_id ?? "");

                    if (!entry) {
                      return (
                        <td key={a.id} className="px-3 py-2.5 border-r last:border-r-0 text-muted-foreground text-xs">
                          —
                        </td>
                      );
                    }

                    return (
                      <td
                        key={a.id}
                        className="px-3 py-2.5 border-r last:border-r-0"
                        onClick={() => {
                          if (!isEditing) {
                            setEditCell({
                              studentId: row.student_id,
                              gradeId: entry.grade_id,
                              value: String(entry.score),
                            });
                          }
                        }}
                      >
                        {isEditing ? (
                          <Input
                            autoFocus
                            type="number"
                            min={0}
                            max={entry.max_score}
                            step={0.5}
                            className="h-7 w-20 px-2 text-xs"
                            value={editCell?.value ?? ""}
                            onChange={(e) =>
                              setEditCell((prev) =>
                                prev ? { ...prev, value: e.target.value } : prev,
                              )
                            }
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitEdit();
                              if (e.key === "Escape") setEditCell(null);
                            }}
                          />
                        ) : (
                          <span
                            className={cn(
                              "cursor-pointer rounded px-1.5 py-0.5 text-xs hover:bg-muted transition-colors",
                              entry.score / entry.max_score < 0.6
                                ? "text-destructive font-medium"
                                : "text-foreground",
                            )}
                          >
                            {entry.score}/{entry.max_score}
                          </span>
                        )}
                      </td>
                    );
                  })}

                  {/* Total */}
                  <td className="px-3 py-2.5 font-medium">
                    <span
                      className={cn(
                        "text-xs",
                        pct < 60
                          ? "text-destructive"
                          : pct >= 90
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-foreground",
                      )}
                    >
                      {pct}%
                    </span>
                    <div className="text-[10px] text-muted-foreground">
                      {Math.round(earned * 10) / 10}/{max}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {students.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">
            No enrolled students found.
          </p>
        )}
      </div>
    </div>
  );
}
