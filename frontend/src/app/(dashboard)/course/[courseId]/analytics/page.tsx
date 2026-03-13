import Link from "next/link";
import { TrendingUp } from "lucide-react";

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

export default async function CourseAnalyticsPage({ params }: Props) {
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
            <BreadcrumbPage>Analytics</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Avg. Grade", value: "—" },
          { label: "Submission Rate", value: "—" },
          { label: "Active Students", value: "—" },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardDescription>{label}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-muted-foreground/40">
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            Course Analytics
          </CardTitle>
          <CardDescription>
            Engagement trends, grade distributions, and at-risk student flags
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <TrendingUp className="h-12 w-12 opacity-20" />
            <p className="text-sm font-medium">No data yet</p>
            <p className="max-w-sm text-center text-xs">
              Course analytics — grade distribution charts, weekly engagement
              trends, assignment completion rates, and AI-flagged at-risk
              students — will be visualized here using Recharts once course
              activity data is collected.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
