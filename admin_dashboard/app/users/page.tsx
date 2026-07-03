"use client";

import { FormEvent, useEffect, useState } from "react";
import { Pencil, Search, Trash2, UserPlus, Users as UsersIcon } from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { EmptyState } from "@/components/empty-state";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { api, Group, User } from "@/lib/api";

type UserForm = {
  username: string;
  password: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  groups: string[];
};

const emptyForm: UserForm = {
  username: "",
  password: "",
  email: "",
  first_name: "",
  last_name: "",
  is_staff: false,
  groups: [],
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    api.get<Group[]>("/user-management/groups/").then((response) => setGroups(response.data));
  }, [page, search]);

  async function load() {
    setLoading(true);
    const response = await api.get<{ count: number; results: User[] }>("/user-management/users/", {
      params: { page, search },
    });
    setUsers(response.data.results);
    setCount(response.data.count);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setFormOpen(true);
  }

  function openEdit(user: User) {
    setEditing(user);
    setForm({
      username: user.username,
      password: "",
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      is_staff: user.is_staff,
      groups: user.groups,
    });
    setError("");
    setFormOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      if (editing) {
        const payload = { ...form };
        if (!payload.password) delete (payload as Partial<UserForm>).password;
        await api.patch(`/user-management/users/${editing.id}/`, payload);
      } else {
        await api.post("/user-management/users/", form);
      }
      setFormOpen(false);
      await load();
    } catch {
      setError("Save failed. Check required fields and group names.");
    }
  }

  async function remove(user: User) {
    if (!confirm(`Delete ${user.username}?`)) return;
    await api.delete(`/user-management/users/${user.id}/`);
    await load();
  }

  async function toggleGroup(user: User, groupName: string) {
    const next = user.groups.includes(groupName)
      ? user.groups.filter((name) => name !== groupName)
      : [...user.groups, groupName];
    await api.patch(`/user-management/users/${user.id}/groups/`, { groups: next });
    await load();
  }

  return (
    <AdminShell>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-muted-foreground">Manage auth users and Django Group assignments.</p>
        </div>
        <Button onClick={openCreate}><UserPlus className="h-4 w-4" /> Create user</Button>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search users" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          </div>
          {loading ? (
            <LoadingSkeleton className="h-80" />
          ) : users.length === 0 ? (
            <EmptyState icon={UsersIcon} title="No users found" description="Create a user or adjust your search filters." />
          ) : (
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Username</Th>
                  <Th>Full name</Th>
                  <Th>Email</Th>
                  <Th>Groups</Th>
                  <Th>Staff</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <Td>{user.username}</Td>
                    <Td>{user.full_name || "not yet"}</Td>
                    <Td>{user.email || "not yet"}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {user.groups.length ? user.groups.map((group) => <Badge key={group}>{group}</Badge>) : <Badge>not yet</Badge>}
                      </div>
                    </Td>
                    <Td>{user.is_staff || user.is_superuser ? "Yes" : "No"}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(user)}>
                          <Pencil className="h-4 w-4" /> Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditing(user)}>
                          <UsersIcon className="h-4 w-4" /> Groups
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => remove(user)}>
                          <Trash2 className="h-4 w-4" /> Delete
                        </Button>
                      </div>
                      {editing?.id === user.id && !formOpen && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {groups.map((group) => (
                            <Button
                              key={group.id}
                              size="sm"
                              variant={user.groups.includes(group.name) ? "default" : "outline"}
                              onClick={() => toggleGroup(user, group.name)}
                            >
                              {group.name}
                            </Button>
                          ))}
                        </div>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          )}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{count} users</p>
            <div className="flex gap-2">
              <Button variant="outline" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
                Previous
              </Button>
              <Button variant="outline" disabled={page * 20 >= count} onClick={() => setPage((value) => value + 1)}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit user" : "Create user"}</DialogTitle>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={submit}>
            <Input placeholder="Username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
            <Input placeholder="Password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            <Input placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="First name" value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} />
              <Input placeholder="Last name" value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_staff} onChange={(event) => setForm({ ...form, is_staff: event.target.checked })} />
              Staff user
            </label>
            <div className="flex flex-wrap gap-2">
              {groups.map((group) => (
                <Button
                  key={group.id}
                  type="button"
                  size="sm"
                  variant={form.groups.includes(group.name) ? "default" : "outline"}
                  onClick={() =>
                    setForm({
                      ...form,
                      groups: form.groups.includes(group.name)
                        ? form.groups.filter((name) => name !== group.name)
                        : [...form.groups, group.name],
                    })
                  }
                >
                  {group.name}
                </Button>
              ))}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button>{editing ? "Save changes" : "Create user"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
