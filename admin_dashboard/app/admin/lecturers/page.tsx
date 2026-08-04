"use client";

import { useEffect, useState } from "react";
import { UserRound, BookOpen } from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, Course, User } from "@/lib/api";

export default function LecturersPage() {
  const [lecturers, setLecturers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignDialog, setAssignDialog] = useState<User | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<{ results?: User[] }>("/user-management/users/?group=Lecturer&page_size=100").catch(() => ({ data: { results: [] } })),
      api.get<Course[]>("/courses/").catch(() => ({ data: [] })),
    ]).then(([l, c]) => {
      setLecturers(Array.isArray(l.data) ? l.data : (l.data as any)?.results ?? []);
      setCourses(Array.isArray(c.data) ? c.data : (c.data as any)?.results ?? []);
      setLoading(false);
    });
  }, []);

  async function assignCourse(courseId: number) {
    if (!assignDialog) return;
    await api.post("/courses/assign-lecturer/", { lecturer_id: assignDialog.id, course_id: courseId });
  }

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Lecturer-Programme Mapping</h1>
        <p className="text-muted-foreground">Assign lecturers to courses (programmes) for programme locking.</p>
      </div>
      {loading ? <LoadingSkeleton className="h-64" /> : lecturers.length === 0 ? (
        <EmptyState icon={UserRound} title="No lecturers found" description="Create lecturer users first." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lecturers.map((lecturer) => (
            <Card key={lecturer.id} className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <UserRound className="h-5 w-5 text-primary" />
                  {lecturer.full_name || lecturer.username}
                </CardTitle>
                <p className="text-sm text-muted-foreground">{lecturer.email}</p>
              </CardHeader>
              <CardContent>
                <p className="mb-2 text-sm font-medium">Assigned Courses:</p>
                <div className="mb-3 flex flex-wrap gap-1">
                  <Badge className="text-xs">All courses access via list</Badge>
                </div>
                <Button size="sm" variant="outline" className="w-full" onClick={() => setAssignDialog(lecturer)}>
                  <BookOpen className="mr-2 h-4 w-4" /> Manage Assignments
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!assignDialog} onOpenChange={() => setAssignDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Courses to {assignDialog?.full_name || assignDialog?.username}</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-auto">
            {courses.map((course) => (
              <button
                key={course.id}
                className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted"
                onClick={() => { assignCourse(course.id); }}
              >
                <span className="font-medium">{course.name}</span>
                <Badge>{course.code}</Badge>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
