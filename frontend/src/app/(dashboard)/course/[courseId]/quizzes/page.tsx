import Link from "next/link";
import { HelpCircle, Plus } from "lucide-react";

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

export default async function QuizzesPage({ params }: Props) {
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
              <BreadcrumbPage>Quizzes</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <Button render={<Link href={`/course/${courseId}/quizzes/new`} />} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            New Quiz
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-muted-foreground" />
            Quizzes
          </CardTitle>
          <CardDescription>
            Scheduled assessments, practice tests, and graded quizzes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
            <HelpCircle className="h-12 w-12 opacity-20" />
            <p className="text-sm font-medium">No quizzes scheduled</p>
            <p className="max-w-sm text-center text-xs">
              Quizzes and assessments will appear here when published. Each
              quiz shows its availability window, time limit, number of
              attempts, and your best score.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
