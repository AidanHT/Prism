import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";

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

export default async function AnnouncementsPage({ params }: Props) {
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
              <BreadcrumbPage>Announcements</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Button render={<Link href={`/course/${courseId}/announcements/new`} />} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            New Announcement
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-muted-foreground" />
            Announcements
          </CardTitle>
          <CardDescription>
            Course-wide updates and notices from instructors
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <Megaphone className="h-12 w-12 opacity-20" />
            <p className="text-sm font-medium">No announcements yet</p>
            <p className="max-w-sm text-center text-xs">
              Announcements posted by your instructor will appear here. You can
              also subscribe to receive email notifications for new posts.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
