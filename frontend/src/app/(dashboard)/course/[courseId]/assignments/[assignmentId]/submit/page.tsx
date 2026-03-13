import Link from "next/link";
import { Upload } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  params: Promise<{ courseId: string; assignmentId: string }>;
};

export default async function AssignmentSubmitPage({ params }: Props) {
  const { courseId, assignmentId } = await params;

  return (
    <div className="flex flex-col gap-4">
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
              >
                {assignmentId}
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Submit</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-muted-foreground" />
            Submit Assignment
          </CardTitle>
          <CardDescription>
            Upload files, write a text response, or paste a URL submission
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <Upload className="h-12 w-12 opacity-20" />
            <p className="text-sm font-medium">Submission form</p>
            <p className="max-w-sm text-center text-xs">
              The submission interface — drag-and-drop file upload, text entry,
              or URL input — will be implemented here. Submission confirmation,
              receipt, and late-penalty warnings will also appear.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
