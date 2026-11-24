"use client";

import { useEffect, useState } from "react";
import { BookOpen, UserRound } from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, Course, LecturerAssignment, User } from "@/lib/api";

export default function LecturersPage() {
  const [lecturers, setLecturers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<LecturerAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignDialog, setAssignDialog] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<{ results?: User[] }>("/user-management/users/?group=Lecturer&page_size=100").catch(() => ({ data: { results: [] } })),
      api.get<Course[]>("/courses/").catch(() => ({ data: [] })),
      api.get<LecturerAssignment[]>("/courses/lecturer-assignments/").catch(() => ({ data: [] })),
    ]).then(([l, c, a]) => {
      setLecturers(Array.isArray(l.data) ? l.data : (l.data as { results?: User[] })?.results ?? []);
      setCourses(Array.isArray(c.data) ? c.data : (c.data as { results?: Course[] })?.results ?? []);
      setAssignments(Array.isArray(a.data) ? a.data : []);
      setLoading(false);
    });
  }, []);

  async function loadAssignments() {
    const response = await api.get<LecturerAssignment[]>("/courses/lecturer-assignments/");
    setAssignments(Array.isArray(response.data) ? response.data : []);
  }

  function assignmentsFor(lecturerId: number) {
    return assignments.filter((assignment) => assignment.lecturer === lecturerId);
  }

  async function toggleCourse(courseId: number) {
    if (!assignDialog) return;
    setSaving(true);
    setError("");
    const existing = assignments.find(
      (assignment) =>
        assignment.lecturer === assignDialog.id && assignment.course === courseId,
    );
    try {
      if (existing) {
        await api.delete(`/courses/lecturer-assignments/${existing.id}/`);
      } else {
        await api.post("/courses/assign-lecturer/", {
          lecturer_id: assignDialog.id,
          course_id: courseId,
        });
      }
      await loadAssignments();
    } catch {
      setError("Failed to update lecturer assignments.");
    } finally {
      setSaving(false);
    }
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
          {lecturers.map((lecturer) => {
            const lecturerAssignments = assignmentsFor(lecturer.id);
            return (
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
                    {lecturerAssignments.length === 0 ? (
                      <span className="text-xs text-muted-foreground">No courses assigned</span>
                    ) : lecturerAssignments.map((assignment) => (
                      <Badge key={assignment.id}>
                        {assignment.course_name} ({assignment.course_code})
                      </Badge>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setError("");
                      setAssignDialog(lecturer);
                    }}
                  >
                    <BookOpen className="mr-2 h-4 w-4" /> Manage Assignments
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!assignDialog} onOpenChange={() => setAssignDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Courses to {assignDialog?.full_name || assignDialog?.username}</DialogTitle>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="max-h-80 space-y-2 overflow-auto">
            {courses.map((course) => {
              const assigned = assignments.some(
                (assignment) =>
                  assignment.lecturer === assignDialog?.id &&
                  assignment.course === course.id,
              );
              return (
                <button
                  key={course.id}
                  className={`flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted ${assigned ? "border-emerald-200 bg-emerald-50" : ""}`}
                  onClick={() => toggleCourse(course.id)}
                  disabled={saving}
                >
                  <span className="font-medium">{course.name}</span>
                  <span className="flex items-center gap-2">
                    <Badge>{course.code}</Badge>
                    <Badge className={assigned ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}>
                      {assigned ? "Assigned" : "Assign"}
                    </Badge>
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
