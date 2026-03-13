import Link from "next/link";
import { BarChart2 } from "lucide-react";

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

export default async function GradesPage({ params }: Props) {
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
            <BreadcrumbPage>Grades</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-muted-foreground" />
            My Grades
          </CardTitle>
          <CardDescription>
            Your current grade, assignment scores, and grade history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <BarChart2 className="h-12 w-12 opacity-20" />
            <p className="text-sm font-medium">No grades recorded</p>
            <p className="max-w-sm text-center text-xs">
              Your running total, assignment-by-assignment scores, letter
              grade, and a what-if grade calculator will all appear here once
              assignments are graded and released.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
