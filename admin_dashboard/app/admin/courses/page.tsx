"use client";

import { FormEvent, useEffect, useState } from "react";
import { BookOpen, Plus, Pencil, Trash2, Users, UserCheck } from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { api, Course, Department, User } from "@/lib/api";

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [lecturers, setLecturers] = useState<User[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignDialog, setAssignDialog] = useState<{ type: "lecturer" | "student"; course: Course } | null>(null);
  const [editing, setEditing] = useState<Course | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [departmentId, setDepartmentId] = useState<number | "">("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<Course[]>("/courses/").catch(() => ({ data: [] })),
      api.get<Department[]>("/departments/").catch(() => ({ data: [] })),
      api.get<{ results?: User[] }>("/user-management/users/?group=Lecturer&page_size=100").catch(() => ({ data: { results: [] } })),
      api.get<{ results?: User[] }>("/user-management/users/?group=Student&page_size=100").catch(() => ({ data: { results: [] } })),
    ]).then(([c, d, l, s]) => {
      setCourses(Array.isArray(c.data) ? c.data : (c.data as any)?.results ?? []);
      setDepartments(Array.isArray(d.data) ? d.data : []);
      setLecturers(Array.isArray(l.data) ? l.data : (l.data as any)?.results ?? []);
      setStudents(Array.isArray(s.data) ? s.data : (s.data as any)?.results ?? []);
      setLoading(false);
    });
  }, []);

  function openCreate() { setEditing(null); setName(""); setCode(""); setDepartmentId(""); setError(""); setDialogOpen(true); }

  function openEdit(c: Course) { setEditing(c); setName(c.name); setCode(c.code); setDepartmentId(c.department); setError(""); setDialogOpen(true); }

  async function submit(e: FormEvent) {
    e.preventDefault(); setError("");
    try {
      if (editing) {
        await api.patch(`/courses/${editing.id}/`, { name, code, department_id: departmentId || undefined });
      } else {
        await api.post("/courses/", { name, code, department_id: departmentId });
      }
      setDialogOpen(false);
      const res = await api.get<Course[]>("/courses/");
      setCourses(Array.isArray(res.data) ? res.data : (res.data as any)?.results ?? []);
    } catch { setError("Failed to save course."); }
  }

  async function assignUser(userId: number) {
    if (!assignDialog) return;
    const key = assignDialog.type === "lecturer" ? "lecturer_id" : "student_id";
    await api.post(`/courses/assign-${assignDialog.type}/`, { [key]: userId, course_id: assignDialog.course.id });
    setAssignDialog(null);
  }

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Courses</h1>
          <p className="text-muted-foreground">Manage courses and assignments.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Course</Button>
      </div>
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-6">
          {loading ? <LoadingSkeleton className="h-64" /> : courses.length === 0 ? (
            <EmptyState icon={BookOpen} title="No courses" description="Create your first course." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Code</Th>
                  <Th>Name</Th>
                  <Th>Department</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id}>
                    <Td className="font-mono">{c.code}</Td>
                    <Td className="font-medium">{c.name}</Td>
                    <Td>{departments.find((d) => d.id === c.department)?.name ?? "-"}</Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="outline" onClick={() => setAssignDialog({ type: "lecturer", course: c })}><Users className="h-4 w-4" /> Lecturer</Button>
                        <Button size="sm" variant="outline" onClick={() => setAssignDialog({ type: "student", course: c })}><UserCheck className="h-4 w-4" /> Student</Button>
                      </div>
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
          <DialogHeader><DialogTitle>{editing ? "Edit Course" : "Add Course"}</DialogTitle></DialogHeader>
          <form className="grid gap-3" onSubmit={submit}>
            <Input placeholder="Course name" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="Course code" value={code} onChange={(e) => setCode(e.target.value)} />
            <select className="flex h-10 w-full rounded-xl border bg-background px-3 text-sm" value={departmentId} onChange={(e) => setDepartmentId(Number(e.target.value) || "")}>
              <option value="">Select department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button>{editing ? "Save" : "Create"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!assignDialog} onOpenChange={() => setAssignDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign {assignDialog?.type} to {assignDialog?.course.name}</DialogTitle></DialogHeader>
          <div className="max-h-80 space-y-2 overflow-auto">
            {(assignDialog?.type === "lecturer" ? lecturers : students).map((u) => (
              <button key={u.id} className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted" onClick={() => assignUser(u.id)}>
                <span className="font-medium">{u.full_name || u.username}</span>
                <Badge>{u.email}</Badge>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
