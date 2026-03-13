import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="flex max-w-lg flex-col items-center gap-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-2xl font-bold shadow-lg">
          P
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Prism LMS
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          AI-powered Learning Management System. Manage courses, assignments,
          quizzes, and more — all in one place.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
