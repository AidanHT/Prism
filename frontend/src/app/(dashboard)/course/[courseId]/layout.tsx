import { type ReactNode } from "react";

import { CourseShell } from "./_components/CourseShell";

/**
 * Course layout – Server Component.
 *
 * Reads courseId from the URL params (server-side) and passes it to the
 * CourseShell client component, which handles navigation, animations, and
 * live course data. Keeping this file as a Server Component means:
 *
 *  - The RSC boundary is at CourseShell, not here.
 *  - children (page content) are still rendered as RSC on the server.
 *  - We avoid shipping unnecessary JS for the layout skeleton itself.
 */

type Props = { children: ReactNode; params: Promise<{ courseId: string }> };

export default async function CourseLayout({ children, params }: Props) {
  const { courseId } = await params;
  return <CourseShell courseId={courseId}>{children}</CourseShell>;
}
