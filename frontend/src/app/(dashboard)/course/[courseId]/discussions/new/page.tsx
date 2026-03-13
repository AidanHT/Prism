import Link from "next/link";
import { MessageSquare } from "lucide-react";

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

export default async function NewDiscussionPage({ params }: Props) {
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
              <Link href={`/course/${courseId}/discussions`}>Discussions</Link>
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
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            New Discussion
          </CardTitle>
          <CardDescription>
            Start a new discussion thread or prompt for course participants
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <MessageSquare className="h-12 w-12 opacity-20" />
            <p className="text-sm font-medium">Discussion composer</p>
            <p className="max-w-sm text-center text-xs">
              The discussion creation form — with topic title, rich-text body,
              graded participation toggle, allow-replies settings, and
              availability dates — will be built here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
