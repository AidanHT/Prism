import Link from "next/link";
import { BookOpen } from "lucide-react";

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

type Props = { params: Promise<{ courseId: string; slug: string }> };

export default async function PageDetailPage({ params }: Props) {
  const { courseId, slug } = await params;

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
              <Link href={`/course/${courseId}/pages`}>Pages</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{slug}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-muted-foreground" />
            Page
          </CardTitle>
          <CardDescription>
            Rich-text course page content authored by the instructor
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <BookOpen className="h-12 w-12 opacity-20" />
            <p className="text-sm font-medium">Page not found</p>
            <p className="max-w-sm text-center text-xs">
              This page&apos;s rich-text content — including instructor notes,
              embedded media, and inline assignments — will render here once
              the content API is connected.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
