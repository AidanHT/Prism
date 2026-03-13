import Link from "next/link";
import { ListChecks, Plus } from "lucide-react";

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

export default async function RubricsPage({ params }: Props) {
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
              <BreadcrumbPage>Rubrics</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Button render={<Link href={`/course/${courseId}/rubrics/new`} />} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            New Rubric
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-muted-foreground" />
            Rubrics
          </CardTitle>
          <CardDescription>
            Grading rubrics that define criteria and point values for
            assignments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <ListChecks className="h-12 w-12 opacity-20" />
            <p className="text-sm font-medium">No rubrics created</p>
            <p className="max-w-sm text-center text-xs">
              Rubrics define the criteria used to grade student submissions.
              The AI Grading Co-pilot (Claude Opus via Bedrock) will use
              rubrics to generate suggested scores and feedback in
              SpeedGrader.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
