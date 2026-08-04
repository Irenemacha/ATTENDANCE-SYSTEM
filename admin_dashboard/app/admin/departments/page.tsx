"use client";

import { FormEvent, useEffect, useState } from "react";
import { Building2, Plus, Pencil, Trash2 } from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { api, Department } from "@/lib/api";

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const res = await api.get<Department[]>("/departments/");
    setDepartments(res.data);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setName("");
    setError("");
    setDialogOpen(true);
  }

  function openEdit(d: Department) {
    setEditing(d);
    setName(d.name);
    setError("");
    setDialogOpen(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (editing) {
        await api.patch(`/departments/${editing.id}/`, { name });
      } else {
        await api.post("/departments/", { name });
      }
      setDialogOpen(false);
      await load();
    } catch {
      setError("Failed to save department.");
    }
  }

  async function remove(d: Department) {
    if (!confirm(`Delete ${d.name}?`)) return;
    await api.delete(`/departments/${d.id}/`);
    await load();
  }

  return (
    <AdminShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Departments</h1>
          <p className="text-muted-foreground">Manage academic departments.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> Add Department</Button>
      </div>
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-6">
          {loading ? <LoadingSkeleton className="h-64" /> : departments.length === 0 ? (
            <EmptyState icon={Building2} title="No departments" description="Create your first department." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>ID</Th>
                  <Th>Name</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {departments.map((d) => (
                  <tr key={d.id}>
                    <Td>{d.id}</Td>
                    <Td className="font-medium">{d.name}</Td>
                    <Td>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="destructive" onClick={() => remove(d)}><Trash2 className="h-4 w-4" /></Button>
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
          <DialogHeader><DialogTitle>{editing ? "Edit Department" : "Add Department"}</DialogTitle></DialogHeader>
          <form className="grid gap-3" onSubmit={submit}>
            <Input placeholder="Department name" value={name} onChange={(e) => setName(e.target.value)} />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button>{editing ? "Save" : "Create"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
