"use client";

import { useCallback, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  CheckCircle2,
  FileText,
  Link2,
  Paperclip,
  Upload,
  X,
} from "lucide-react";

import { assignmentApi, fileApi } from "@/lib/api";
import { useApiOpts } from "@/hooks/useApiOpts";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ── Allowed MIME types by submission type ────────────────────────────────────

const ALLOWED_MIME: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "text/plain": [".txt", ".c", ".s", ".h", ".cpp", ".py", ".js", ".ts"],
  "application/zip": [".zip"],
  "application/x-tar": [".tar"],
  "text/x-csrc": [".c"],
  "text/x-asm": [".s"],
};

function isAllowedType(file: File): boolean {
  return Object.keys(ALLOWED_MIME).includes(file.type) || file.type === "";
}

// ── Zod schema ────────────────────────────────────────────────────────────────

const submitSchema = z
  .object({
    textBody: z.string().optional(),
    fileUrl: z.string().optional(),
    urlInput: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  })
  .refine(
    (d) =>
      (d.textBody && d.textBody.trim().length > 0) ||
      (d.fileUrl && d.fileUrl.trim().length > 0) ||
      (d.urlInput && d.urlInput.trim().length > 0),
    { message: "Provide at least one submission (text, file, or URL)." },
  );

type SubmitFormValues = z.infer<typeof submitSchema>;

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
      label: "•",
      cmd: () => editor?.chain().focus().toggleBulletList().run(),
      active: () => editor?.isActive("bulletList") ?? false,
    },
    {
      label: "</>",
      cmd: () => editor?.chain().focus().toggleCode().run(),
      active: () => editor?.isActive("code") ?? false,
    },
  ] as const;

  return (
    <div className="rounded-lg border bg-background overflow-hidden">
      <div className="flex items-center gap-0.5 border-b px-2 py-1.5">
        {toggles.map(({ label, cmd, active }) => (
          <button
            key={label}
            type="button"
            onClick={cmd}
            className={cn(
              "rounded px-2 py-1 text-xs font-medium transition-colors",
              active() ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <EditorContent
        editor={editor}
        className="min-h-[200px] px-4 py-3 [&_.ProseMirror]:outline-none prose prose-sm dark:prose-invert max-w-none"
      />
    </div>
  );
}

// ── File drop zone ────────────────────────────────────────────────────────────

function FileDropZone({
  onFile,
  uploading,
  uploaded,
  progress,
}: {
  onFile: (file: File) => void;
  uploading: boolean;
  uploaded: boolean;
  progress: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [typeError, setTypeError] = useState<string | null>(null);

  function handleFile(file: File) {
    if (!isAllowedType(file)) {
      setTypeError(
        `File type "${file.type || "unknown"}" is not allowed. Accepted: PDF, plain text, C/S source, ZIP.`,
      );
      return;
    }
    setTypeError(null);
    setFileName(file.name);
    onFile(file);
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="space-y-1.5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 transition-colors select-none",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30",
          uploaded && "border-emerald-500 bg-emerald-500/5",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        {uploaded ? (
          <>
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              {fileName} — uploaded
            </p>
          </>
        ) : uploading ? (
          <>
            <Upload className="h-8 w-8 animate-pulse text-primary" />
            <p className="text-sm text-muted-foreground">
              Uploading… {progress}%
            </p>
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <Paperclip className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">
                Drag & drop or click to select a file
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                PDF, .c, .s, .txt, .py, .zip — max 100 MB
              </p>
            </div>
            {fileName && (
              <div className="flex items-center gap-1.5 rounded-md bg-muted px-3 py-1">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs">{fileName}</span>
              </div>
            )}
          </>
        )}
      </div>
      {typeError && <p className="text-xs text-destructive">{typeError}</p>}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AssignmentSubmitPage() {
  const { courseId, assignmentId } = useParams<{
    courseId: string;
    assignmentId: string;
  }>();
  const opts = useApiOpts();
  const router = useRouter();
  const qc = useQueryClient();

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileUploading, setFileUploading] = useState(false);
  const [fileUploaded, setFileUploaded] = useState(false);
  const [s3FileUrl, setS3FileUrl] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: assignment, isLoading } = useQuery({
    queryKey: ["assignment", assignmentId],
    queryFn: () => assignmentApi.get(assignmentId, opts),
    enabled: !!opts.userId,
    staleTime: 60_000,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SubmitFormValues>({
    resolver: zodResolver(submitSchema),
    defaultValues: { textBody: "", fileUrl: "", urlInput: "" },
  });

  // ── S3 upload ────────────────────────────────────────────────────────────────

  async function uploadToS3(file: File): Promise<string> {
    setFileUploading(true);
    setUploadProgress(10);

    const urlData = await fileApi.uploadUrl(
      {
        course_id: courseId,
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        folder_path: "submissions",
      },
      opts,
    );

    setUploadProgress(40);

    const formData = new FormData();
    for (const [key, val] of Object.entries(urlData.fields)) {
      formData.append(key, val);
    }
    formData.append("file", file); // must be last

    const s3Res = await fetch(urlData.url, { method: "POST", body: formData });
    if (!s3Res.ok && s3Res.status !== 204) {
      throw new Error(`S3 upload failed: ${s3Res.status}`);
    }

    setUploadProgress(100);
    setFileUploading(false);
    setFileUploaded(true);

    // Derive public URL from presigned URL base + key
    const bucketBase = urlData.url.replace(/\?.*$/, "");
    return `${bucketBase}/${urlData.s3_key}`;
  }

  async function handleFileSelected(file: File) {
    setPendingFile(file);
    try {
      const url = await uploadToS3(file);
      setS3FileUrl(url);
      setValue("fileUrl", url);
    } catch (err) {
      setFileUploading(false);
      toast.error("File upload failed", {
        description:
          "Could not upload to S3. You can paste the file URL manually if S3 is not configured.",
      });
      console.error(err);
    }
  }

  // ── Final submission ─────────────────────────────────────────────────────────

  const submitMutation = useMutation({
    mutationFn: (values: SubmitFormValues) => {
      const payload: { body?: string; file_url?: string } = {};
      if (values.textBody?.trim()) payload.body = values.textBody;
      if (values.fileUrl?.trim()) payload.file_url = values.fileUrl;
      else if (values.urlInput?.trim()) payload.file_url = values.urlInput;
      return assignmentApi.submit(assignmentId, payload, opts);
    },
    onSuccess: () => {
      toast.success("Submitted!", { description: "Your work has been received." });
      void qc.invalidateQueries({ queryKey: ["my-submission", assignmentId] });
      void qc.invalidateQueries({ queryKey: ["my-submissions", courseId] });
      router.push(`/course/${courseId}/assignments/${assignmentId}`);
    },
    onError: () =>
      toast.error("Submission failed", { description: "Please try again." }),
  });

  function onFormValid(values: SubmitFormValues) {
    // Swap in the uploaded S3 URL if available
    if (s3FileUrl && !values.fileUrl) values.fileUrl = s3FileUrl;
    setConfirmOpen(true);
  }

  const formValues = watch();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <p className="text-sm text-destructive">
        Could not load assignment. Is the backend running?
      </p>
    );
  }

  const types = assignment.submission_types;

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
            <BreadcrumbLink asChild>
              <Link
                href={`/course/${courseId}/assignments/${assignmentId}`}
                className="max-w-[160px] truncate block"
              >
                {assignment.title}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Submit</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-5 w-5 text-muted-foreground" />
            Submit — {assignment.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onFormValid)} className="space-y-6">
            {/* Text submission */}
            {types.includes("text") && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <FileText className="h-4 w-4" />
                  Written Response
                </Label>
                <RichEditor
                  onChange={(html) => setValue("textBody", html)}
                />
              </div>
            )}

            {/* File upload */}
            {types.includes("file") && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <Paperclip className="h-4 w-4" />
                  File Upload
                </Label>
                <FileDropZone
                  onFile={handleFileSelected}
                  uploading={fileUploading}
                  uploaded={fileUploaded}
                  progress={uploadProgress}
                />
                {/* Manual URL fallback (e.g., when S3 is not configured locally) */}
                {!fileUploaded && !pendingFile && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Or paste a direct file URL:
                    </p>
                    <Input
                      {...register("fileUrl")}
                      type="url"
                      placeholder="https://s3.example.com/your-file.pdf"
                      className="text-xs"
                    />
                  </div>
                )}
              </div>
            )}

            {/* URL submission */}
            {types.includes("url") && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <Link2 className="h-4 w-4" />
                  Submission URL
                </Label>
                <Input
                  {...register("urlInput")}
                  type="url"
                  placeholder="https://docs.google.com/…"
                />
                {errors.urlInput && (
                  <p className="text-xs text-destructive">
                    {errors.urlInput.message}
                  </p>
                )}
              </div>
            )}

            {/* Root validation error */}
            {errors.root && (
              <p className="text-xs text-destructive">{errors.root.message}</p>
            )}

            <div className="flex items-center gap-3 pt-1">
              <Button
                type="submit"
                disabled={fileUploading || submitMutation.isPending}
              >
                {fileUploading ? "Uploading file…" : "Review & Submit"}
              </Button>
              <Button variant="ghost" asChild>
                <Link
                  href={`/course/${courseId}/assignments/${assignmentId}`}
                >
                  Cancel
                </Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Submission</DialogTitle>
            <DialogDescription>
              You are submitting your work for{" "}
              <strong>{assignment.title}</strong>. This will replace any
              previous submission (resubmissions are allowed until the lock
              date).
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm space-y-1">
            {formValues.textBody?.trim() && (
              <p>
                <span className="font-medium">Text response:</span>{" "}
                {formValues.textBody.replace(/<[^>]*>/g, "").slice(0, 80)}
                {formValues.textBody.length > 80 ? "…" : ""}
              </p>
            )}
            {(formValues.fileUrl?.trim() || s3FileUrl) && (
              <p className="flex items-center gap-1">
                <Paperclip className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate text-xs text-muted-foreground">
                  {formValues.fileUrl || s3FileUrl}
                </span>
              </p>
            )}
            {formValues.urlInput?.trim() && (
              <p className="flex items-center gap-1">
                <Link2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate text-xs text-muted-foreground">
                  {formValues.urlInput}
                </span>
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              <X className="mr-1.5 h-4 w-4" />
              Go Back
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                submitMutation.mutate({
                  textBody: formValues.textBody,
                  fileUrl: formValues.fileUrl || s3FileUrl || undefined,
                  urlInput: formValues.urlInput,
                });
              }}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? "Submitting…" : "Confirm & Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
