import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";

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
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ courseId: string }> };

export default async function PagesListPage({ params }: Props) {
  const { courseId } = await params;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={`/course/${courseId}`}>Course</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Pages</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Button asChild size="sm">
          <Link href="#">
            <Plus className="mr-1.5 h-4 w-4" />
            New Page
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-muted-foreground" />
            Pages
          </CardTitle>
          <CardDescription>
            Rich-text course pages — lecture notes, reading guides, and
            supplemental content
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <BookOpen className="h-12 w-12 opacity-20" />
            <p className="text-sm font-medium">No pages yet</p>
            <p className="max-w-sm text-center text-xs">
              Course pages are rich-text documents authored by instructors.
              They can include text, images, embedded media, and links to other
              course resources.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
