"use client";

import { FormEvent, useEffect, useState } from "react";

import { AdminShell } from "@/components/admin-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { api, Group, Permission } from "@/lib/api";

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Group | null>(null);

  useEffect(() => {
    load();
    api.get<Permission[]>("/user-management/permissions/").then((response) => setPermissions(response.data));
  }, []);

  async function load() {
    const response = await api.get<Group[]>("/user-management/groups/");
    setGroups(response.data);
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    await api.post("/user-management/groups/", { name });
    setName("");
    await load();
  }

  async function togglePermission(permissionId: number) {
    if (!selected) return;
    const next = selected.permissions.includes(permissionId)
      ? selected.permissions.filter((id) => id !== permissionId)
      : [...selected.permissions, permissionId];
    const response = await api.patch<Group>(`/user-management/groups/${selected.id}/permissions/`, { permissions: next });
    setSelected(response.data);
    await load();
  }

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Groups</h1>
        <p className="text-muted-foreground">Manage Django Groups and permission assignments.</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardContent className="pt-6">
            <form className="mb-4 flex gap-2" onSubmit={create}>
              <Input placeholder="New group name" value={name} onChange={(event) => setName(event.target.value)} />
              <Button>Create</Button>
            </form>
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Permissions</Th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <tr key={group.id} className="cursor-pointer hover:bg-muted/60" onClick={() => setSelected(group)}>
                    <Td>{group.name}</Td>
                    <Td>{group.permissions.length}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <h2 className="mb-3 text-lg font-semibold">{selected ? `${selected.name} permissions` : "Select a group"}</h2>
            <div className="grid max-h-[620px] gap-2 overflow-auto pr-2">
              {selected &&
                permissions.map((permission) => (
                  <button
                    key={permission.id}
                    className="flex items-center justify-between rounded-md border p-3 text-left hover:bg-muted"
                    onClick={() => togglePermission(permission.id)}
                  >
                    <span>
                      <span className="font-medium">{permission.name}</span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {permission.app_label}.{permission.model}.{permission.codename}
                      </span>
                    </span>
                    {selected.permissions.includes(permission.id) && <Badge>Assigned</Badge>}
                  </button>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
