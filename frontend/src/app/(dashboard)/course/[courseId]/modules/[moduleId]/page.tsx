import Link from "next/link";
import { Layers } from "lucide-react";

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

type Props = { params: Promise<{ courseId: string; moduleId: string }> };

export default async function ModuleDetailPage({ params }: Props) {
  const { courseId, moduleId } = await params;

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
              <Link href={`/course/${courseId}/modules`}>Modules</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{moduleId}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-muted-foreground" />
            Module
          </CardTitle>
          <CardDescription>
            Module items: pages, assignments, files, and external URLs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <Layers className="h-12 w-12 opacity-20" />
            <p className="text-sm font-medium">Module not loaded</p>
            <p className="max-w-sm text-center text-xs">
              The ordered list of items in this module — pages, assignments,
              quizzes, and files — will be displayed here with completion
              tracking.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
