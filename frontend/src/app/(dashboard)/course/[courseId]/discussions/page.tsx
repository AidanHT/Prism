import Link from "next/link";
import { MessageSquare, Plus } from "lucide-react";

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

export default async function DiscussionsPage({ params }: Props) {
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
              <BreadcrumbPage>Discussions</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Button asChild size="sm">
          <Link href={`/course/${courseId}/discussions/new`}>
            <Plus className="mr-1.5 h-4 w-4" />
            New Discussion
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            Discussions
          </CardTitle>
          <CardDescription>
            Collaborative forums for course topics, Q&amp;A, and peer exchange
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <MessageSquare className="h-12 w-12 opacity-20" />
            <p className="text-sm font-medium">No discussions yet</p>
            <p className="max-w-sm text-center text-xs">
              Discussion boards will appear here. Participate in instructor-led
              prompts or start a peer thread. Replies, likes, and graded
              participation are all tracked here.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
