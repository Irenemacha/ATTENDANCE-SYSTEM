"use client";

import { FormEvent, useEffect, useState } from "react";
import { UserCheck, Trash2, Plus } from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, Td, Th } from "@/components/ui/table";
import { api, Course, Enrollment, User } from "@/lib/api";

export default function EnrollmentPage() {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseFilter, setCourseFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [studentId, setStudentId] = useState<number | "">("");
  const [courseId, setCourseId] = useState<number | "">("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load();
    Promise.all([
      api.get<Course[]>("/courses/").catch(() => ({ data: [] })),
      api.get<{ results?: User[] }>("/user-management/users/?group=Student&page_size=100").catch(() => ({ data: { results: [] } })),
    ]).then(([c, s]) => {
      setCourses(Array.isArray(c.data) ? c.data : (c.data as any)?.results ?? []);
      setStudents(Array.isArray(s.data) ? s.data : (s.data as any)?.results ?? []);
    });
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<Enrollment[]>("/courses/enrollments/");
      setEnrollments(Array.isArray(res.data) ? res.data : []);
    } catch {
      setEnrollments([]);
    }
    setLoading(false);
  }

  function openCreate() {
    setStudentId("");
    setCourseId("");
    setError("");
    setDialogOpen(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await api.post("/courses/enrollments/", { student_id: studentId, course_id: courseId });
      setDialogOpen(false);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to enroll student.");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(enrollment: Enrollment) {
    if (!confirm(`Remove ${enrollment.student_name} from ${enrollment.course_name}?`)) return;
    try {
      await api.delete(`/courses/enrollments/${enrollment.id}/`);
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to remove enrollment.");
    }
  }

  const filtered = enrollments.filter(
    (e) => !courseFilter || e.course === Number(courseFilter),
  );

  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Student Enrollment</h1>
          <p className="text-muted-foreground">Enroll students into courses and manage existing enrollments.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Enroll Student</Button>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap gap-3">
            <select
              className="flex h-10 rounded-xl border bg-background px-3 text-sm"
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
            >
              <option value="">All courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
          </div>

          {loading ? (
            <LoadingSkeleton className="h-64" />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={UserCheck}
              title="No enrollments"
              description="Enroll a student into a course to get started."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Student</Th>
                  <Th>Reg Number</Th>
                  <Th>Course</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <Td className="font-medium">
                      {e.student_name}{" "}
                      <span className="font-mono text-muted-foreground">({e.student_username})</span>
                    </Td>
                    <Td className="font-mono">{e.reg_number || "-"}</Td>
                    <Td>
                      <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200">
                        {e.course_name} ({e.course_code})
                      </Badge>
                    </Td>
                    <Td>
                      <Button size="sm" variant="destructive" onClick={() => remove(e)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enroll Student</DialogTitle>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={submit}>
            <select
              className="flex h-10 w-full rounded-xl border bg-background px-3 text-sm"
              value={studentId}
              onChange={(e) => setStudentId(Number(e.target.value) || "")}
              required
            >
              <option value="">Select student</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name || s.username} ({s.username})
                </option>
              ))}
            </select>

            <select
              className="flex h-10 w-full rounded-xl border bg-background px-3 text-sm"
              value={courseId}
              onChange={(e) => setCourseId(Number(e.target.value) || "")}
              required
            >
              <option value="">Select course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button disabled={submitting || !studentId || !courseId}>
              {submitting ? "Enrolling..." : "Enroll Student"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
