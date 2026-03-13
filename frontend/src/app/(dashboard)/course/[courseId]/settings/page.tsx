import Link from "next/link";
import { Settings } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = { params: Promise<{ courseId: string }> };

export default async function CourseSettingsPage({ params }: Props) {
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
            <BreadcrumbPage>Settings</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="text-muted-foreground h-5 w-5" />
            Course Settings
          </CardTitle>
          <CardDescription>
            Configure course name, enrollment, visibility, grading scheme, and integrations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 py-4">
            {[
              {
                section: "Course Details",
                desc: "Name, code, term, description, and banner image",
              },
              {
                section: "Enrollment",
                desc: "Enrollment type, capacity, waitlist, and self-enrollment codes",
              },
              {
                section: "Grading",
                desc: "Grading scheme, late-submission policy, and extra-credit rules",
              },
              {
                section: "Visibility",
                desc: "Course visibility, content access dates, and LTI integrations",
              },
            ].map(({ section, desc }) => (
              <div key={section} className="flex items-start justify-between rounded-lg border p-4">
                <div>
                  <p className="text-sm font-medium">{section}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">{desc}</p>
                </div>
                <span className="text-muted-foreground/50 text-xs">Coming soon</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
