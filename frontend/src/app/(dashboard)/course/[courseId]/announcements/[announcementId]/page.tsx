import Link from "next/link";
import { Megaphone } from "lucide-react";

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
  params: Promise<{ courseId: string; announcementId: string }>;
};

export default async function AnnouncementDetailPage({ params }: Props) {
  const { courseId, announcementId } = await params;

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
              <Link href={`/course/${courseId}/announcements`}>
                Announcements
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{announcementId}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-muted-foreground" />
            Announcement Detail
          </CardTitle>
          <CardDescription>
            Full announcement content, author, and reply thread
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <Megaphone className="h-12 w-12 opacity-20" />
            <p className="text-sm font-medium">Announcement not loaded</p>
            <p className="max-w-sm text-center text-xs">
              The full announcement body, posted-by details, and student reply
              thread will render here once the data layer is wired up.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
