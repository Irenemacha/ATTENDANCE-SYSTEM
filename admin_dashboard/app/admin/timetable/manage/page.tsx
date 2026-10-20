"use client";

import { FormEvent, useEffect, useState } from "react";
import { CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { api, Course, TimetableEntry, User } from "@/lib/api";
import { TIMETABLE_DAYS, dayLabel, formatTime } from "@/lib/timetable";

type EntryForm = {
  course_code: string;
  lecturer: string;
  day: string;
  start_time: string;
  end_time: string;
  room: string;
};

const emptyForm: EntryForm = {
  course_code: "",
  lecturer: "",
  day: "MON",
  start_time: "08:00",
  end_time: "10:00",
  room: "",
};

export default function ManageTimetablePage() {
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lecturers, setLecturers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TimetableEntry | null>(null);
  const [form, setForm] = useState<EntryForm>(emptyForm);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
    Promise.all([
      api.get<Course[]>("/courses/").catch(() => ({ data: [] })),
      api.get<{ count: number; results: User[] }>("/user-management/users/", {
        params: { group: "Lecturer", page_size: 100 },
      }).catch(() => ({ data: { results: [] } })),
    ]).then(([c, l]) => {
      setCourses(Array.isArray(c.data) ? c.data : (c.data as any)?.results ?? []);
      setLecturers(Array.isArray(l.data) ? l.data : l.data.results ?? []);
    });
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<TimetableEntry[]>("/courses/timetable/");
      setEntries(Array.isArray(res.data) ? res.data : []);
    } catch {
      setEntries([]);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setDialogOpen(true);
  }

  function openEdit(entry: TimetableEntry) {
    setEditing(entry);
    setForm({
      course_code: entry.course_code,
      lecturer: entry.lecturer_username,
      day: entry.day,
      start_time: formatTime(entry.start_time),
      end_time: formatTime(entry.end_time),
      room: entry.room,
    });
    setError("");
    setDialogOpen(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (editing) {
        await api.patch(`/courses/timetable/${editing.id}/`, form);
      } else {
        await api.post("/courses/timetable/", form);
      }
      setDialogOpen(false);
      await load();
    } catch (err: any) {
      const data = err?.response?.data;
      const messages = data?.errors?.flatMap((item: { errors: string[] }) => item.errors);
      setError(messages?.length ? messages.join(" ") : "Failed to save timetable entry.");
    }
  }

  async function remove(entry: TimetableEntry) {
    if (!confirm(`Delete ${entry.course_code} on ${dayLabel(entry.day)} at ${formatTime(entry.start_time)}?`)) return;
    await api.delete(`/courses/timetable/${entry.id}/`);
    await load();
  }

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Manage Timetable</h1>
          <p className="text-muted-foreground">Create, edit, or remove timetable entries.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Entry</Button>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-6">
          {loading ? (
            <LoadingSkeleton className="h-64" />
          ) : entries.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No timetable entries"
              description="Add an entry or upload an Excel file to get started."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Day</Th>
                  <Th>Course</Th>
                  <Th>Lecturer</Th>
                  <Th>Time</Th>
                  <Th>Room</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <Td>
                      <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200">
                        {dayLabel(entry.day)}
                      </Badge>
                    </Td>
                    <Td className="font-medium">
                      {entry.course_name} <span className="font-mono text-muted-foreground">({entry.course_code})</span>
                    </Td>
                    <Td>{entry.lecturer_username}</Td>
                    <Td className="font-mono">
                      {formatTime(entry.start_time)} - {formatTime(entry.end_time)}
                    </Td>
                    <Td>{entry.room}</Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(entry)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => remove(entry)}>
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
            <DialogTitle>{editing ? "Edit Timetable Entry" : "Add Timetable Entry"}</DialogTitle>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={submit}>
            <select
              className="flex h-10 w-full rounded-xl border bg-background px-3 text-sm"
              value={form.course_code}
              onChange={(e) => setForm({ ...form, course_code: e.target.value })}
            >
              <option value="">Select course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.code}>{c.name} ({c.code})</option>
              ))}
            </select>

            <select
              className="flex h-10 w-full rounded-xl border bg-background px-3 text-sm"
              value={form.lecturer}
              onChange={(e) => setForm({ ...form, lecturer: e.target.value })}
            >
              <option value="">Select lecturer</option>
              {lecturers.map((u) => (
                <option key={u.id} value={u.username}>
                  {u.full_name || u.username}
                </option>
              ))}
            </select>

            <select
              className="flex h-10 w-full rounded-xl border bg-background px-3 text-sm"
              value={form.day}
              onChange={(e) => setForm({ ...form, day: e.target.value })}
            >
              {TIMETABLE_DAYS.map((d) => (
                <option key={d.code} value={d.code}>{d.label}</option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground">Start time</label>
                <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground">End time</label>
                <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} required />
              </div>
            </div>

            <Input
              placeholder="Room (e.g. LH-101)"
              value={form.room}
              onChange={(e) => setForm({ ...form, room: e.target.value })}
              required
            />

            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button>{editing ? "Save Changes" : "Create Entry"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
