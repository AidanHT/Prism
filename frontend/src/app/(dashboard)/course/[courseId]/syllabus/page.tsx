import Link from "next/link";
import { BookMarked } from "lucide-react";

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

export default async function SyllabusPage({ params }: Props) {
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
            <BreadcrumbPage>Syllabus</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookMarked className="h-5 w-5 text-muted-foreground" />
            Syllabus
          </CardTitle>
          <CardDescription>
            Course description, objectives, grading policy, and schedule
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <BookMarked className="h-12 w-12 opacity-20" />
            <p className="text-sm font-medium">No syllabus published</p>
            <p className="max-w-sm text-center text-xs">
              The course syllabus — learning objectives, weekly schedule,
              grading breakdown, attendance policy, and required materials —
              will be displayed here as a rich-text document.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
