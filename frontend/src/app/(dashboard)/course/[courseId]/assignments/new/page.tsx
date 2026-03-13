import Link from "next/link";
import { ClipboardList } from "lucide-react";

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

type Props = { params: Promise<{ courseId: string }> };

export default async function NewAssignmentPage({ params }: Props) {
  const { courseId } = await params;

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
            <BreadcrumbPage>New</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-muted-foreground" />
            New Assignment
          </CardTitle>
          <CardDescription>
            Define assignment details, submission type, rubric, due dates, and
            point values
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <ClipboardList className="h-12 w-12 opacity-20" />
            <p className="text-sm font-medium">Assignment editor</p>
            <p className="max-w-sm text-center text-xs">
              The assignment creation form — with rich-text instructions,
              submission type selection, due date picker, point value, and
              rubric attachment — will be built here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
