"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ClipboardList, Plus, Sparkles, Trash2 } from "lucide-react";

import { assignmentApi } from "@/lib/api";
import { useApiOpts } from "@/hooks/useApiOpts";
import { RubricGeneratorModal } from "@/components/rubric/RubricGeneratorModal";
import type { GeneratedCriterion } from "@/lib/types";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

// ── Zod schema ────────────────────────────────────────────────────────────────

const SUBMISSION_TYPES = ["text", "file", "url"] as const;

const assignmentSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(255),
    description: z.string().optional(),
    points_possible: z
      .number({ error: "Must be a number" })
      .min(0, "Must be ≥ 0"),
    due_date: z.string().optional(),
    lock_date: z.string().optional(),
    submission_types: z
      .array(z.enum(SUBMISSION_TYPES))
      .min(1, "Select at least one submission type"),
    is_published: z.boolean(),
  })
  .refine(
    (d) => {
      if (!d.due_date || !d.lock_date) return true;
      return d.lock_date >= d.due_date;
    },
    {
      message: "Lock date must be on or after the due date",
      path: ["lock_date"],
    },
  );

type AssignmentFormValues = z.infer<typeof assignmentSchema>;

// ── Rubric types ──────────────────────────────────────────────────────────────

type Rating = { label: string; points: number };
type Criterion = { id: string; description: string; ratings: Rating[] };

function newCriterion(): Criterion {
  return {
    id: crypto.randomUUID(),
    description: "",
    ratings: [
      { label: "Full Marks", points: 10 },
      { label: "Partial", points: 5 },
      { label: "No Marks", points: 0 },
    ],
  };
}

// ── TipTap editor ─────────────────────────────────────────────────────────────

function RichEditor({ onChange }: { onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  const toggles = [
    {
      label: "B",
      cmd: () => editor?.chain().focus().toggleBold().run(),
      active: () => editor?.isActive("bold") ?? false,
    },
    {
      label: "I",
      cmd: () => editor?.chain().focus().toggleItalic().run(),
      active: () => editor?.isActive("italic") ?? false,
    },
    {
      label: "H2",
      cmd: () =>
        editor?.chain().focus().toggleHeading({ level: 2 }).run(),
      active: () =>
        editor?.isActive("heading", { level: 2 }) ?? false,
    },
    {
      label: "•",
      cmd: () => editor?.chain().focus().toggleBulletList().run(),
      active: () => editor?.isActive("bulletList") ?? false,
    },
    {
      label: "1.",
      cmd: () => editor?.chain().focus().toggleOrderedList().run(),
      active: () => editor?.isActive("orderedList") ?? false,
    },
    {
      label: "</>",
      cmd: () => editor?.chain().focus().toggleCodeBlock().run(),
      active: () => editor?.isActive("codeBlock") ?? false,
    },
  ] as const;

  return (
    <div className="rounded-lg border bg-background overflow-hidden">
      <div className="flex flex-wrap items-center gap-0.5 border-b px-2 py-1.5">
        {toggles.map(({ label, cmd, active }) => (
          <button
            key={label}
            type="button"
            onClick={cmd}
            className={cn(
              "rounded px-2 py-1 text-xs font-medium transition-colors",
              active()
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <EditorContent
        editor={editor}
        className="min-h-[180px] px-4 py-3 [&_.ProseMirror]:outline-none prose prose-sm dark:prose-invert max-w-none"
      />
    </div>
  );
}

// ── Rubric builder ────────────────────────────────────────────────────────────

function RubricBuilder({
  criteria,
  onChange,
}: {
  criteria: Criterion[];
  onChange: (c: Criterion[]) => void;
}) {
  function addCriterion() {
    onChange([...criteria, newCriterion()]);
  }

  function removeCriterion(id: string) {
    onChange(criteria.filter((c) => c.id !== id));
  }

  function updateDescription(id: string, description: string) {
    onChange(
      criteria.map((c) => (c.id === id ? { ...c, description } : c)),
    );
  }

  function addRating(criterionId: string) {
    onChange(
      criteria.map((c) =>
        c.id === criterionId
          ? { ...c, ratings: [...c.ratings, { label: "New Rating", points: 0 }] }
          : c,
      ),
    );
  }

  function removeRating(criterionId: string, ratingIdx: number) {
    onChange(
      criteria.map((c) =>
        c.id === criterionId
          ? {
              ...c,
              ratings: c.ratings.filter((_, i) => i !== ratingIdx),
            }
          : c,
      ),
    );
  }

  function updateRating(
    criterionId: string,
    ratingIdx: number,
    field: keyof Rating,
    value: string | number,
  ) {
    onChange(
      criteria.map((c) =>
        c.id === criterionId
          ? {
              ...c,
              ratings: c.ratings.map((r, i) =>
                i === ratingIdx ? { ...r, [field]: value } : r,
              ),
            }
          : c,
      ),
    );
  }

  if (criteria.length === 0) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addCriterion}
      >
        <Plus className="mr-1.5 h-4 w-4" />
        Add Rubric Criterion
      </Button>
    );
  }

  return (
    <div className="space-y-3">
      {criteria.map((criterion, ci) => (
        <div key={criterion.id} className="rounded-lg border bg-muted/20 p-3">
          <div className="flex items-start gap-2 mb-2">
            <Input
              value={criterion.description}
              onChange={(e) => updateDescription(criterion.id, e.target.value)}
              placeholder={`Criterion ${ci + 1} description`}
              className="text-sm"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeCriterion(criterion.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Rating columns */}
          <div className="flex flex-wrap gap-2">
            {criterion.ratings.map((rating, ri) => (
              <div
                key={ri}
                className="flex flex-col gap-1 rounded-md border bg-background p-2 min-w-[120px]"
              >
                <Input
                  value={rating.label}
                  onChange={(e) =>
                    updateRating(criterion.id, ri, "label", e.target.value)
                  }
                  placeholder="Label"
                  className="h-7 text-xs"
                />
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    value={rating.points}
                    onChange={(e) =>
                      updateRating(
                        criterion.id,
                        ri,
                        "points",
                        Number(e.target.value),
                      )
                    }
                    className="h-7 w-16 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">pts</span>
                  {criterion.ratings.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRating(criterion.id, ri)}
                      className="ml-auto text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addRating(criterion.id)}
              className="flex min-w-[80px] items-center justify-center gap-1 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add Rating
            </button>
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={addCriterion}>
        <Plus className="mr-1.5 h-4 w-4" />
        Add Criterion
      </Button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NewAssignmentPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const opts = useApiOpts();
  const router = useRouter();
  const qc = useQueryClient();

  const [rubricCriteria, setRubricCriteria] = useState<Criterion[]>([]);
  const [generatorOpen, setGeneratorOpen] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AssignmentFormValues>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      points_possible: 100,
      submission_types: ["text"],
      is_published: false,
    },
  });

  const watchedTitle = watch("title");
  const watchedDescription = watch("description");

  function handleApplyGeneratedRubric(generatedCriteria: GeneratedCriterion[]) {
    const mapped: Criterion[] = generatedCriteria.map((gc) => ({
      id: crypto.randomUUID(),
      description: gc.description,
      ratings: gc.ratings.map((r) => ({ label: r.description, points: r.points })),
    }));
    setRubricCriteria(mapped);
  }

  const createMutation = useMutation({
    mutationFn: (values: AssignmentFormValues) =>
      assignmentApi.create(
        courseId,
        {
          course_id: courseId,
          title: values.title,
          description: values.description,
          points_possible: values.points_possible,
          due_date: values.due_date
            ? new Date(values.due_date).toISOString()
            : undefined,
          lock_date: values.lock_date
            ? new Date(values.lock_date).toISOString()
            : undefined,
          submission_types: values.submission_types,
          is_published: values.is_published,
        },
        opts,
      ),
    onSuccess: (data) => {
      toast.success("Assignment created!");
      void qc.invalidateQueries({ queryKey: ["assignments", courseId] });
      router.push(`/course/${courseId}/assignments/${data.id}`);
    },
    onError: () =>
      toast.error("Failed to create assignment", {
        description: "Check that the backend is running and dates are valid.",
      }),
  });

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
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
            <BreadcrumbLink asChild>
              <Link href={`/course/${courseId}/assignments`}>Assignments</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>New</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            New Assignment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit((v) => createMutation.mutate(v))}
            className="space-y-6"
          >
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                {...register("title")}
                placeholder="e.g. RISC-V Processor Design"
              />
              {errors.title && (
                <p className="text-xs text-destructive">
                  {errors.title.message}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>Description / Instructions</Label>
              <RichEditor
                onChange={(html) => setValue("description", html)}
              />
            </div>

            <Separator />

            {/* Points + Dates */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="points">Points Possible</Label>
                <Input
                  id="points"
                  type="number"
                  min={0}
                  step={0.5}
                  {...register("points_possible")}
                />
                {errors.points_possible && (
                  <p className="text-xs text-destructive">
                    {errors.points_possible.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="datetime-local"
                  {...register("due_date")}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="lock_date">Lock Date</Label>
                <Input
                  id="lock_date"
                  type="datetime-local"
                  {...register("lock_date")}
                />
                {errors.lock_date && (
                  <p className="text-xs text-destructive">
                    {errors.lock_date.message}
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Submission types */}
            <div className="space-y-2">
              <Label>Submission Types</Label>
              <p className="text-xs text-muted-foreground">
                Select all that apply.
              </p>
              <Controller
                name="submission_types"
                control={control}
                render={({ field }) => (
                  <div className="flex flex-wrap gap-4">
                    {SUBMISSION_TYPES.map((type) => (
                      <div
                        key={type}
                        className="flex items-center gap-2"
                      >
                        <Checkbox
                          id={`st-${type}`}
                          checked={field.value.includes(type)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              field.onChange([...field.value, type]);
                            } else {
                              field.onChange(
                                field.value.filter((t) => t !== type),
                              );
                            }
                          }}
                        />
                        <label
                          htmlFor={`st-${type}`}
                          className="cursor-pointer text-sm capitalize"
                        >
                          {type}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              />
              {errors.submission_types && (
                <p className="text-xs text-destructive">
                  {errors.submission_types.message}
                </p>
              )}
            </div>

            <Separator />

            {/* Rubric builder */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Rubric</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setGeneratorOpen(true)}
                  className="h-7 gap-1.5 text-xs"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Generate with AI
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Define scoring criteria manually or let the AI generate a rubric
                from your assignment instructions.
              </p>
              <RubricBuilder
                criteria={rubricCriteria}
                onChange={setRubricCriteria}
              />
            </div>

            <Separator />

            {/* Publish toggle */}
            <div className="flex items-center gap-3">
              <Controller
                name="is_published"
                control={control}
                render={({ field }) => (
                  <Switch
                    id="published"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="published" className="cursor-pointer">
                Publish immediately
              </Label>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-1">
              <Button
                type="submit"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? "Creating…" : "Create Assignment"}
              </Button>
              <Button variant="ghost" render={<Link href={`/course/${courseId}/assignments`} />}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <RubricGeneratorModal
        open={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
        courseId={courseId}
        assignmentTitle={watchedTitle ?? ""}
        assignmentInstructions={watchedDescription ?? ""}
        onApply={handleApplyGeneratedRubric}
        opts={opts}
      />
    </div>
  );
}
