import Link from "next/link";
import { FolderOpen, Upload } from "lucide-react";

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

export default async function FilesPage({ params }: Props) {
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
              <BreadcrumbPage>Files</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Button asChild size="sm">
          <Link href="#">
            <Upload className="mr-1.5 h-4 w-4" />
            Upload File
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
            Files
          </CardTitle>
          <CardDescription>
            Course files and folders — PDFs, slides, and shared resources
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <FolderOpen className="h-12 w-12 opacity-20" />
            <p className="text-sm font-medium">No files uploaded</p>
            <p className="max-w-sm text-center text-xs">
              Files shared by the instructor — lecture slides, PDFs, datasets,
              and other resources — appear here organized in folders. Students
              can preview and download; instructors can upload and manage
              permissions.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
