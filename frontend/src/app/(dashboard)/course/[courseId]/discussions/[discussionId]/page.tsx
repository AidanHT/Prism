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

type Props = {
  params: Promise<{ courseId: string; discussionId: string }>;
};

export default async function DiscussionDetailPage({ params }: Props) {
  const { courseId, discussionId } = await params;

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
            <BreadcrumbPage>{discussionId}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            Discussion Thread
          </CardTitle>
          <CardDescription>
            Original post, nested replies, likes, and reply composer
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <MessageSquare className="h-12 w-12 opacity-20" />
            <p className="text-sm font-medium">Thread not loaded</p>
            <p className="max-w-sm text-center text-xs">
              The threaded discussion view — original post, replies, reply
              composer, and participation-grade tracking — will render here
              once the data layer is connected.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
