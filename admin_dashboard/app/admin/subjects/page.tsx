"use client";

import { FormEvent, useEffect, useState } from "react";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { api, Course, Subject } from "@/lib/api";

type SubjectForm = {
  name: string;
  code: string;
  course_id: number | "";
};

const emptyForm: SubjectForm = { name: "", code: "", course_id: "" };

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseFilter, setCourseFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState<SubjectForm>(emptyForm);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<Subject[]>("/courses/subjects/").catch(() => ({ data: [] })),
      api.get<Course[]>("/courses/").catch(() => ({ data: [] })),
    ]).then(([s, c]) => {
      setSubjects(Array.isArray(s.data) ? s.data : []);
      setCourses(Array.isArray(c.data) ? c.data : (c.data as any)?.results ?? []);
      setLoading(false);
    });
  }, []);

  async function loadSubjects() {
    const res = await api.get<Subject[]>("/courses/subjects/").catch(() => ({ data: [] as Subject[] }));
    setSubjects(Array.isArray(res.data) ? res.data : []);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setDialogOpen(true);
  }

  function openEdit(subject: Subject) {
    setEditing(subject);
    setForm({ name: subject.name, code: subject.code, course_id: subject.course });
    setError("");
    setDialogOpen(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (editing) {
        await api.patch(`/courses/subjects/${editing.id}/`, form);
      } else {
        await api.post("/courses/subjects/", form);
      }
      setDialogOpen(false);
      await loadSubjects();
    } catch (err: any) {
      const data = err?.response?.data;
      const messages = data?.errors?.flatMap((item: { errors: string[] }) => item.errors);
      setError(messages?.length ? messages.join(" ") : "Failed to save subject.");
    }
  }

  async function remove(subject: Subject) {
    if (!confirm(`Delete ${subject.name} (${subject.code})?`)) return;
    try {
      await api.delete(`/courses/subjects/${subject.id}/`);
      await loadSubjects();
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to delete subject.");
    }
  }

  const filtered = subjects.filter((s) => !courseFilter || s.course === Number(courseFilter));

  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Subjects</h1>
          <p className="text-muted-foreground">Manage subjects taught under each course.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Subject</Button>
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
              icon={BookOpen}
              title="No subjects"
              description="Add a subject or filter by a different course."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Code</Th>
                  <Th>Name</Th>
                  <Th>Course</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <Td className="font-mono">{s.code}</Td>
                    <Td className="font-medium">{s.name}</Td>
                    <Td>
                      <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200">
                        {s.course_name} ({s.course_code})
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => remove(s)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Subject" : "Add Subject"}</DialogTitle>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={submit}>
            <Input
              placeholder="Subject name (e.g. Algebra)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              placeholder="Subject code (e.g. CS101)"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              required
            />
            <select
              className="flex h-10 w-full rounded-xl border bg-background px-3 text-sm"
              value={form.course_id}
              onChange={(e) => setForm({ ...form, course_id: Number(e.target.value) || "" })}
              required
            >
              <option value="">Select course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
              ))}
            </select>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button>{editing ? "Save Changes" : "Create Subject"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
