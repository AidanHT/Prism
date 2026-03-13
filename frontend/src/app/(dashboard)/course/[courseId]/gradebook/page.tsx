"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUpDown, Download, Search, TableProperties } from "lucide-react";
import { toast } from "sonner";

import { courseApi, gradeApi } from "@/lib/api";
import type {
  GradebookAssignment,
  GradebookGradeEntry,
  GradebookStudentRow,
} from "@/lib/types";
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface FlatRow {
  student_id: string;
  student_name: string;
  student_email: string;
  enrollment_id: string;
  /** grade_id keyed by assignment_id */
  gradesByAssignment: Map<string, GradebookGradeEntry>;
  totalEarned: number;
  totalMax: number;
}

interface EditCell {
  studentId: string;
  assignmentId: string;
  gradeId: string;
  value: string;
}

// ── Column dimensions ─────────────────────────────────────────────────────────

const STICKY_COL_W = 200;
const DATA_COL_W = 130;
const TOTAL_COL_W = 90;
const ROW_H = 44;
const HEADER_H = 52;

// ── Grade cell ────────────────────────────────────────────────────────────────

function GradeCell({
  entry,
  studentId,
  assignmentId,
  editCell,
  setEditCell,
  onCommit,
}: {
  entry: GradebookGradeEntry | undefined;
  studentId: string;
  assignmentId: string;
  editCell: EditCell | null;
  setEditCell: (c: EditCell | null) => void;
  onCommit: (gradeId: string, score: number) => void;
}) {
  const isEditing =
    editCell?.studentId === studentId &&
    editCell?.assignmentId === assignmentId;

  if (!entry) {
    return (
      <span className="text-muted-foreground text-xs">—</span>
    );
  }

  if (isEditing) {
    return (
      <Input
        autoFocus
        type="number"
        min={0}
        max={entry.max_score}
        step={0.5}
        className="h-7 w-20 px-2 text-xs"
        value={editCell?.value ?? ""}
        onChange={(e) =>
          setEditCell(
            editCell ? { ...editCell, value: e.target.value } : null,
          )
        }
        onBlur={() => {
          const score = parseFloat(editCell?.value ?? "");
          if (!isNaN(score) && score >= 0)
            onCommit(entry.grade_id, score);
          setEditCell(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const score = parseFloat(editCell?.value ?? "");
            if (!isNaN(score) && score >= 0)
              onCommit(entry.grade_id, score);
            setEditCell(null);
          }
          if (e.key === "Escape") setEditCell(null);
        }}
      />
    );
  }

  return (
    <button
      onClick={() =>
        setEditCell({
          studentId,
          assignmentId,
          gradeId: entry.grade_id,
          value: String(entry.score),
        })
      }
      className={cn(
        "rounded px-1.5 py-0.5 text-xs hover:bg-muted transition-colors cursor-pointer",
        entry.score / entry.max_score < 0.6
          ? "text-destructive font-medium"
          : "text-foreground",
      )}
    >
      {entry.score}/{entry.max_score}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GradebookPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const opts = useApiOpts();
  const qc = useQueryClient();

  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "student_name", desc: false },
  ]);
  const [editCell, setEditCell] = useState<EditCell | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Data ────────────────────────────────────────────────────────────────────

  const { data, isLoading, isError } = useQuery({
    queryKey: ["gradebook", courseId],
    queryFn: () => courseApi.gradebook(courseId, opts),
    enabled: !!opts.userId,
    staleTime: 30_000,
  });

  // ── Mutations ───────────────────────────────────────────────────────────────

  const updateGrade = useMutation({
    mutationFn: ({ gradeId, score }: { gradeId: string; score: number }) =>
      gradeApi.update(gradeId, { score }, opts),

    // Optimistic update
    onMutate: async ({ gradeId, score }) => {
      await qc.cancelQueries({ queryKey: ["gradebook", courseId] });
      const previous = qc.getQueryData(["gradebook", courseId]);
      qc.setQueryData(["gradebook", courseId], (old: typeof data) => {
        if (!old) return old;
        return {
          ...old,
          students: old.students.map((s) => ({
            ...s,
            grades: s.grades.map((g) =>
              g.grade_id === gradeId ? { ...g, score } : g,
            ),
          })),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous)
        qc.setQueryData(["gradebook", courseId], ctx.previous);
      toast.error("Failed to update grade");
    },
    onSuccess: () => toast.success("Grade updated"),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["gradebook", courseId] });
    },
  });

  const handleCommit = useCallback(
    (gradeId: string, score: number) => {
      updateGrade.mutate({ gradeId, score });
    },
    [updateGrade],
  );

  // ── CSV export ──────────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/courses/${courseId}/gradebook/export`,
        { headers: { "X-User-Id": opts.userId } },
      );
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gradebook_${courseId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("CSV export failed");
    }
  }, [courseId, opts.userId]);

  // ── Flatten data for TanStack Table ─────────────────────────────────────────

  const assignments: GradebookAssignment[] = data?.assignments ?? [];

  const flatRows: FlatRow[] = useMemo(() => {
    if (!data) return [];
    return data.students.map((s: GradebookStudentRow) => {
      const gradesByAssignment = new Map<string, GradebookGradeEntry>();
      for (const g of s.grades) {
        if (g.assignment_id) gradesByAssignment.set(g.assignment_id, g);
      }
      const totalEarned = s.grades.reduce((acc, g) => acc + g.score, 0);
      const totalMax = s.grades.reduce((acc, g) => acc + g.max_score, 0);
      return {
        student_id: s.student_id,
        student_name: s.student_name,
        student_email: s.student_email,
        enrollment_id: s.enrollment_id,
        gradesByAssignment,
        totalEarned,
        totalMax,
      };
    });
  }, [data]);

  // ── TanStack Table columns ──────────────────────────────────────────────────

  const colHelper = createColumnHelper<FlatRow>();

  const columns = useMemo(
    () =>
      [
        colHelper.accessor("student_name", {
          id: "student_name",
          header: "Student",
          enableSorting: true,
          filterFn: "includesString",
        }),
        // One column per assignment — created dynamically
        ...assignments.map((a) =>
          colHelper.display({
            id: `asgn_${a.id}`,
            header: a.title,
            meta: { assignmentId: a.id, pointsPossible: a.points_possible },
          }),
        ),
        colHelper.display({ id: "total", header: "Total" }),
      ] as ColumnDef<FlatRow, unknown>[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assignments],
  );

  const table = useReactTable({
    data: flatRows,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: "includesString",
  });

  const rows = table.getRowModel().rows;

  // ── Virtualization ──────────────────────────────────────────────────────────

  // Row virtualizer
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 8,
  });

  // Column virtualizer (only assignment columns; sticky + total are excluded)
  const assignmentCols = assignments;
  const colVirtualizer = useVirtualizer({
    count: assignmentCols.length,
    horizontal: true,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => DATA_COL_W,
    overscan: 4,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const virtualCols = colVirtualizer.getVirtualItems();
  const totalRowHeight = rowVirtualizer.getTotalSize();
  const totalColWidth = colVirtualizer.getTotalSize();

  // ── Loading / error guards ──────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-[500px] rounded-xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <p className="text-sm text-destructive">
        Failed to load gradebook. Ensure the backend is running.
      </p>
    );
  }

  const totalContainerWidth =
    STICKY_COL_W + totalColWidth + TOTAL_COL_W;

  // ── Render ──────────────────────────────────────────────────────────────────

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

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <TableProperties className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Gradebook</h1>
          <span className="text-xs text-muted-foreground">
            ({rows.length} students)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search students…"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="h-8 pl-8 w-52 text-sm"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export CSV
          </Button>
          <p className="text-xs text-muted-foreground hidden md:block">
            Click a score to edit
          </p>
        </div>
      </div>

      {/* Virtual table */}
      <div
        ref={scrollRef}
        className="overflow-auto rounded-xl border"
        style={{ maxHeight: "calc(100vh - 220px)", minHeight: 300 }}
      >
        {/* Minimum width so the virtual container is wide enough */}
        <div style={{ minWidth: totalContainerWidth }}>
          {/* ── Sticky header ── */}
          <div
            className="sticky top-0 z-20 flex border-b bg-muted/50"
            style={{ height: HEADER_H }}
          >
            {/* Sticky student column header */}
            <div
              className="sticky left-0 z-30 flex items-end pb-2 px-4 bg-muted/50 border-r shrink-0"
              style={{ width: STICKY_COL_W }}
            >
              <button
                className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                onClick={() =>
                  setSorting((prev) => {
                    const current = prev.find((s) => s.id === "student_name");
                    return [
                      { id: "student_name", desc: current ? !current.desc : false },
                    ];
                  })
                }
              >
                Student
                <ArrowUpDown className="h-3 w-3" />
              </button>
            </div>

            {/* Virtual assignment column headers */}
            <div
              className="relative flex-1"
              style={{ width: totalColWidth }}
            >
              {virtualCols.map((vc) => {
                const asgn = assignments[vc.index];
                if (!asgn) return null;
                return (
                  <div
                    key={vc.key}
                    className="absolute top-0 flex flex-col justify-end pb-2 px-3 border-r"
                    style={{
                      left: vc.start,
                      width: vc.size,
                      height: HEADER_H,
                    }}
                  >
                    <div
                      className="truncate text-xs font-semibold text-muted-foreground"
                      title={asgn.title}
                    >
                      {asgn.title}
                    </div>
                    <div className="text-[10px] opacity-60 font-normal">
                      /{asgn.points_possible}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Total header */}
            <div
              className="sticky right-0 flex items-end pb-2 px-3 bg-muted/50 border-l shrink-0"
              style={{ width: TOTAL_COL_W }}
            >
              <span className="text-xs font-semibold text-muted-foreground">
                Total
              </span>
            </div>
          </div>

          {/* ── Virtual rows ── */}
          <div style={{ position: "relative", height: totalRowHeight }}>
            {virtualRows.map((vr) => {
              const row = rows[vr.index];
              if (!row) return null;
              const flatRow = row.original;
              const pct =
                flatRow.totalMax > 0
                  ? Math.round((flatRow.totalEarned / flatRow.totalMax) * 100)
                  : 0;

              return (
                <div
                  key={vr.key}
                  className={cn(
                    "absolute left-0 right-0 flex border-b hover:bg-muted/20 transition-colors",
                    vr.index % 2 !== 0 ? "bg-muted/10" : "bg-background",
                  )}
                  style={{ top: vr.start, height: vr.size }}
                >
                  {/* Sticky student cell */}
                  <div
                    className="sticky left-0 z-10 flex flex-col justify-center px-4 border-r shrink-0 bg-inherit"
                    style={{ width: STICKY_COL_W }}
                  >
                    <div
                      className="text-sm font-medium truncate"
                      title={flatRow.student_name}
                    >
                      {flatRow.student_name}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {flatRow.student_email}
                    </div>
                  </div>

                  {/* Virtual data cells */}
                  <div
                    className="relative flex-1"
                    style={{ width: totalColWidth }}
                  >
                    {virtualCols.map((vc) => {
                      const asgn = assignments[vc.index];
                      if (!asgn) return null;
                      const entry = flatRow.gradesByAssignment.get(asgn.id);
                      return (
                        <div
                          key={vc.key}
                          className="absolute top-0 flex items-center px-3 border-r"
                          style={{
                            left: vc.start,
                            width: vc.size,
                            height: vr.size,
                          }}
                        >
                          <GradeCell
                            entry={entry}
                            studentId={flatRow.student_id}
                            assignmentId={asgn.id}
                            editCell={editCell}
                            setEditCell={setEditCell}
                            onCommit={handleCommit}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Sticky total cell */}
                  <div
                    className="sticky right-0 flex flex-col justify-center px-3 border-l bg-inherit shrink-0"
                    style={{ width: TOTAL_COL_W }}
                  >
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        pct < 60
                          ? "text-destructive"
                          : pct >= 90
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-foreground",
                      )}
                    >
                      {pct}%
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {Math.round(flatRow.totalEarned * 10) / 10}/
                      {flatRow.totalMax}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">
            {globalFilter ? "No students match your search." : "No enrolled students found."}
          </p>
        )}
      </div>
    </div>
  );
}
