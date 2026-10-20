"use client";

import { FormEvent, useEffect, useState } from "react";
import { CalendarDays, Pencil, Plus, Trash2, X } from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { api, Holiday, Semester } from "@/lib/api";

type SemesterForm = {
  name: string;
  academic_year: string;
  start_date: string;
  end_date: string;
  teaching_weeks: number;
  is_current: boolean;
  holidays: Holiday[];
};

const emptyForm: SemesterForm = {
  name: "",
  academic_year: "",
  start_date: "",
  end_date: "",
  teaching_weeks: 15,
  is_current: false,
  holidays: [],
};

export default function SemestersPage() {
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Semester | null>(null);
  const [form, setForm] = useState<SemesterForm>(emptyForm);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<Semester[]>("/academics/semesters/");
      setSemesters(Array.isArray(res.data) ? res.data : []);
    } catch {
      setSemesters([]);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setDialogOpen(true);
  }

  function openEdit(semester: Semester) {
    setEditing(semester);
    setForm({
      name: semester.name,
      academic_year: semester.academic_year,
      start_date: semester.start_date,
      end_date: semester.end_date,
      teaching_weeks: semester.teaching_weeks,
      is_current: semester.is_current,
      holidays: semester.holidays.map((h) => ({ name: h.name, date: h.date })),
    });
    setError("");
    setDialogOpen(true);
  }

  function addHoliday() {
    setForm((current) => ({
      ...current,
      holidays: [...current.holidays, { name: "", date: "" }],
    }));
  }

  function updateHoliday(index: number, patch: Partial<Holiday>) {
    setForm((current) => ({
      ...current,
      holidays: current.holidays.map((h, i) => (i === index ? { ...h, ...patch } : h)),
    }));
  }

  function removeHoliday(index: number) {
    setForm((current) => ({
      ...current,
      holidays: current.holidays.filter((_, i) => i !== index),
    }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (editing) {
        await api.patch(`/academics/semesters/${editing.id}/`, form);
      } else {
        await api.post("/academics/semesters/", form);
      }
      setDialogOpen(false);
      await load();
    } catch (err: any) {
      const data = err?.response?.data;
      const messages = data?.errors?.flatMap((item: { errors: string[] }) => item.errors);
      setError(messages?.length ? messages.join(" ") : "Failed to save semester.");
    }
  }

  async function remove(semester: Semester) {
    if (!confirm(`Delete ${semester.name} (${semester.academic_year})?`)) return;
    try {
      await api.delete(`/academics/semesters/${semester.id}/`);
      await load();
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to delete semester.");
    }
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
  }

  return (
    <AdminShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Semester Management</h1>
          <p className="text-muted-foreground">Manage the official academic calendar, semester dates, teaching weeks and holidays.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Semester</Button>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-6">
          {loading ? (
            <LoadingSkeleton className="h-64" />
          ) : semesters.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No semesters"
              description="Add a semester to define the academic calendar."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Semester</Th>
                  <Th>Academic Year</Th>
                  <Th>Period</Th>
                  <Th>Teaching Weeks</Th>
                  <Th>Holidays</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {semesters.map((semester) => (
                  <tr key={semester.id}>
                    <Td className="font-medium">{semester.name}</Td>
                    <Td className="font-mono">{semester.academic_year}</Td>
                    <Td>
                      {formatDate(semester.start_date)} - {formatDate(semester.end_date)}
                    </Td>
                    <Td>{semester.teaching_weeks}</Td>
                    <Td>{semester.holidays.length}</Td>
                    <Td>
                      <Badge className={semester.is_current ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}>
                        {semester.is_current ? "Current" : "Inactive"}
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(semester)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => remove(semester)}>
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
            <DialogTitle>{editing ? "Edit Semester" : "Add Semester"}</DialogTitle>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={submit}>
            <Input
              placeholder="Semester name (e.g. Semester 1)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              placeholder="Academic year (e.g. 2025/2026)"
              value={form.academic_year}
              onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground">Start date</label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium text-muted-foreground">End date</label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <label className="text-xs font-medium text-muted-foreground">Teaching weeks</label>
              <Input
                type="number"
                min={0}
                value={form.teaching_weeks}
                onChange={(e) => setForm({ ...form, teaching_weeks: Number(e.target.value) || 0 })}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_current}
                onChange={(e) => setForm({ ...form, is_current: e.target.checked })}
              />
              Mark as the current semester
            </label>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Holidays</label>
                <Button type="button" size="sm" variant="outline" onClick={addHoliday}>
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>
              {form.holidays.length === 0 ? (
                <p className="text-xs text-muted-foreground">No holidays added.</p>
              ) : (
                <div className="grid gap-2">
                  {form.holidays.map((holiday, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        placeholder="Holiday name"
                        value={holiday.name}
                        onChange={(e) => updateHoliday(index, { name: e.target.value })}
                      />
                      <Input
                        type="date"
                        value={holiday.date}
                        onChange={(e) => updateHoliday(index, { date: e.target.value })}
                      />
                      <Button type="button" size="sm" variant="ghost" onClick={() => removeHoliday(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button>{editing ? "Save Changes" : "Create Semester"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
