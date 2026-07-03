"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/admin-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, Group, User } from "@/lib/api";

export default function DashboardPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    Promise.all([
      api.get<{ results?: User[]; count?: number } | User[]>("/user-management/users/?page_size=100"),
      api.get<Group[]>("/user-management/groups/"),
    ]).then(([usersResponse, groupsResponse]) => {
      const userData = Array.isArray(usersResponse.data) ? usersResponse.data : usersResponse.data.results ?? [];
      setUsers(userData);
      setGroups(groupsResponse.data);
    });
  }, []);

  const metrics = useMemo(() => {
    const inGroup = (name: string) => users.filter((user) => user.groups.some((group) => group.toLowerCase() === name)).length;
    return [
      { label: "Total users", value: users.length },
      { label: "Total groups", value: groups.length },
      { label: "Students", value: inGroup("student") },
      { label: "Lecturers", value: inGroup("lecturer") },
      { label: "Unassigned users", value: users.filter((user) => user.groups.length === 0).length },
    ];
  }, [users, groups]);

  return (
    <AdminShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">User and role overview from Django Groups.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">{metric.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold">{metric.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
