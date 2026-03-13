"use client";

import { useState } from "react";
import { useCourseStore } from "@/store/useCourseStore";
import { useAuthStore } from "@/store/useAuthStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { motion } from "framer-motion";
import { Search, Plus, BookOpen } from "lucide-react";
import Link from "next/link";

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

const TERMS = ["All Terms", "Spring 2026", "Fall 2025", "Spring 2025"];
const TYPES = ["All", "Enrolled", "Available"];

export default function CoursesPage() {
  const courses = useCourseStore((s) => s.courses);
  const user = useAuthStore((s) => s.user);
  const isProfessor = user?.role === "Professor";

  const [search, setSearch] = useState("");
  const [termFilter, setTermFilter] = useState("All Terms");
  const [typeFilter, setTypeFilter] = useState("All");

  const filtered = courses.filter((c) => {
    const matchSearch =
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase());
    const matchTerm = termFilter === "All Terms" || c.term === termFilter;
    return matchSearch && matchTerm;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Courses</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{courses.length} courses enrolled</p>
        </div>
        {isProfessor && (
          <Dialog>
            <DialogTrigger render={<Button />}>
              <Plus className="h-4 w-4 mr-1" /> Create Course
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a New Course</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label htmlFor="create-code" className="text-sm font-medium">Course Code</label>
                  <Input id="create-code" placeholder="e.g. CS 499" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="create-title" className="text-sm font-medium">Course Title</label>
                  <Input id="create-title" placeholder="e.g. Advanced Topics in AI" />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="create-term" className="text-sm font-medium">Term</label>
                  <Input id="create-term" placeholder="e.g. Fall 2026" />
                </div>
                <Button className="w-full">Create Course</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {TERMS.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={termFilter === t ? "default" : "outline"}
              onClick={() => setTermFilter(t)}
            >
              {t}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          {TYPES.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={typeFilter === t ? "secondary" : "ghost"}
              onClick={() => setTypeFilter(t)}
            >
              {t}
            </Button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No courses match your search.</p>
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {filtered.map((course) => (
            <motion.div key={course.id} variants={itemVariants}>
              <Link href={`/course/${course.id}`}>
                <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer group h-full">
                  <div className="h-2 w-full" style={{ backgroundColor: course.colorCode }} />
                  <CardHeader className="pb-2 pt-3">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className="text-xs font-mono"
                        style={{ borderColor: course.colorCode, color: course.colorCode }}
                      >
                        {course.code}
                      </Badge>
                      <span className="text-muted-foreground text-xs">{course.term}</span>
                    </div>
                    <CardTitle className="text-sm leading-snug mt-2 group-hover:text-primary transition-colors">
                      {course.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <p className="text-muted-foreground text-xs">Prof. Johnson</p>
                    <div className="flex gap-2 mt-3 flex-wrap">
                      <Badge variant="secondary" className="text-xs">
                        3 assignments
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        24 students
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
