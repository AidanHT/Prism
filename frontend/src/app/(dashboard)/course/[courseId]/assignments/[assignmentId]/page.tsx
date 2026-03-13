"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  ClipboardList,
  Upload,
  FileText,
  Link2,
  Calendar,
  Star,
  CheckCircle2,
} from "lucide-react";

import { assignmentApi } from "@/lib/api";
import { useApiOpts } from "@/hooks/useApiOpts";
import { useAuthStore } from "@/store/useAuthStore";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

// ── Minimal TipTap editor ─────────────────────────────────────────────────────

function RichEditor({ onUpdate }: { onUpdate: (html: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: "",
    immediatelyRender: false,
    onUpdate: ({ editor: e }) => onUpdate(e.getHTML()),
  });

  const toggles = [
    { label: "B", cmd: () => editor?.chain().focus().toggleBold().run(), active: () => editor?.isActive("bold") },
    { label: "I", cmd: () => editor?.chain().focus().toggleItalic().run(), active: () => editor?.isActive("italic") },
    { label: "•", cmd: () => editor?.chain().focus().toggleBulletList().run(), active: () => editor?.isActive("bulletList") },
    { label: "</>", cmd: () => editor?.chain().focus().toggleCode().run(), active: () => editor?.isActive("code") },
  ] as const;

  return (
    <div className="rounded-lg border bg-background overflow-hidden">
      <div className="flex items-center gap-0.5 border-b px-2 py-1.5">
        {toggles.map(({ label, cmd, active }) => (
          <button
            key={label}
            type="button"
            onClick={cmd}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              active() ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AssignmentDetailPage() {
  const { courseId, assignmentId } = useParams<{ courseId: string; assignmentId: string }>();
  const opts = useApiOpts();
  const role = useAuthStore((s) => s.user?.role ?? "Student");

  const [textBody, setTextBody] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: assignment, isLoading, isError } = useQuery({
    queryKey: ["assignment", assignmentId],
    queryFn: () => assignmentApi.get(assignmentId, opts),
    enabled: !!opts.userId,
    staleTime: 60_000,
  });

  const submitMutation = useMutation({
    mutationFn: () => {
      const types = assignment?.submission_types ?? [];
      const payload: { body?: string; file_url?: string } = {};
      if (types.includes("text") && textBody.trim()) payload.body = textBody;
      if (types.includes("file") && fileUrl.trim()) payload.file_url = fileUrl;
      if (types.includes("url") && urlInput.trim()) payload.file_url = urlInput;
      return assignmentApi.submit(assignmentId, payload, opts);
    },
    onSuccess: () => {
      toast.success("Submission received!", { description: "Your work has been submitted." });
      setSubmitted(true);
    },
    onError: () =>
      toast.error("Submission failed", { description: "Check your inputs and try again." }),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (isError || !assignment) {
    return (
      <p className="text-sm text-destructive">Could not load assignment. Is the backend running?</p>
    );
  }

  const types = assignment.submission_types;
  const isInstructor = role === "Professor" || role === "TA";

  const canSubmit =
    !submitted &&
    ((types.includes("text") && textBody.trim().length > 0) ||
      (types.includes("file") && fileUrl.trim().length > 0) ||
      (types.includes("url") && urlInput.trim().length > 0));

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
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
            <BreadcrumbPage className="max-w-[200px] truncate">{assignment.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Metadata card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base leading-snug">
                <ClipboardList className="h-5 w-5 shrink-0 text-muted-foreground" />
                {assignment.title}
              </CardTitle>
              <div className="mt-2 flex flex-wrap gap-1">
                {types.map((t) => (
                  <Badge key={t} variant="outline" className="text-xs capitalize">
                    {t}
                  </Badge>
                ))}
              </div>
            </div>
            {isInstructor && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/course/${courseId}/assignments/${assignmentId}/grade`}>
                  <Star className="mr-1.5 h-4 w-4" /> SpeedGrader
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Star className="h-4 w-4" />
              <span className="font-medium text-foreground">{assignment.points_possible} pts</span>
            </div>
            {assignment.due_date && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>
                  Due{" "}
                  <span className="font-medium text-foreground">
                    {format(parseISO(assignment.due_date), "MMM d, yyyy 'at' h:mm a")}
                  </span>
                </span>
              </div>
            )}
          </div>

          <Separator />

          {assignment.description ? (
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{assignment.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">No description provided.</p>
          )}
        </CardContent>
      </Card>

      {/* Submission panel (students only) */}
      {!isInstructor && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-5 w-5 text-muted-foreground" />
              {submitted ? "Submission Received" : "Submit Your Work"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                <p className="font-medium">Your submission has been recorded.</p>
                <p className="text-sm text-muted-foreground">
                  Check your Grades page once your instructor reviews it.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {types.includes("text") && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-sm font-medium">
                      <FileText className="h-4 w-4" /> Written Response
                    </Label>
                    <RichEditor onUpdate={setTextBody} />
                  </div>
                )}

                {types.includes("file") && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-sm font-medium">
                      <Upload className="h-4 w-4" /> File URL
                    </Label>
                    <Input
                      type="text"
                      placeholder="https://s3.example.com/your-file.pdf"
                      value={fileUrl}
                      onChange={(e) => setFileUrl(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Upload your file to cloud storage then paste the URL here.
                    </p>
                  </div>
                )}

                {types.includes("url") && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-sm font-medium">
                      <Link2 className="h-4 w-4" /> Submission URL
                    </Label>
                    <Input
                      type="url"
                      placeholder="https://docs.google.com/…"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                    />
                  </div>
                )}

                <Button
                  disabled={!canSubmit || submitMutation.isPending}
                  onClick={() => submitMutation.mutate()}
                >
                  {submitMutation.isPending ? "Submitting…" : "Submit Assignment"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
