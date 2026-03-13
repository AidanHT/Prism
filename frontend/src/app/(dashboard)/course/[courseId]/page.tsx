import Link from "next/link";
import {
  BookOpen,
  ClipboardList,
  Megaphone,
  MessageSquare,
  HelpCircle,
} from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
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

export default async function CourseHomePage({ params }: Props) {
  const { courseId } = await params;

  const quickLinks = [
    {
      label: "Announcements",
      href: `/course/${courseId}/announcements`,
      Icon: Megaphone,
      description: "Latest updates from your instructor",
    },
    {
      label: "Assignments",
      href: `/course/${courseId}/assignments`,
      Icon: ClipboardList,
      description: "Upcoming and past assignments",
    },
    {
      label: "Quizzes",
      href: `/course/${courseId}/quizzes`,
      Icon: HelpCircle,
      description: "Scheduled and completed quizzes",
    },
    {
      label: "Discussions",
      href: `/course/${courseId}/discussions`,
      Icon: MessageSquare,
      description: "Course discussion boards",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Course Home</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-muted-foreground" />
            Welcome to Your Course
          </CardTitle>
          <CardDescription>
            Your course home page — announcements, upcoming work, and quick
            navigation will appear here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {quickLinks.map(({ label, href, Icon, description }) => (
              <Link key={href} href={href} className="group block">
                <div className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
                  <div>
                    <p className="text-sm font-medium leading-none">{label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
          <CardDescription>
            Recent course activity will be surfaced here in a future update.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
            <BookOpen className="h-10 w-10 opacity-20" />
            <p className="text-sm">No recent activity</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
