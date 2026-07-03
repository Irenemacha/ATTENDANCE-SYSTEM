"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Shield, UserCheck, UserRound, Users } from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, Group, User } from "@/lib/api";

export default function DashboardPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ results?: User[]; count?: number } | User[]>("/user-management/users/?page_size=100"),
      api.get<Group[]>("/user-management/groups/"),
    ]).then(([usersResponse, groupsResponse]) => {
      const userData = Array.isArray(usersResponse.data) ? usersResponse.data : usersResponse.data.results ?? [];
      setUsers(userData);
      setGroups(groupsResponse.data);
      setLoading(false);
    });
  }, []);

  const metrics = useMemo(() => {
    const inGroup = (name: string) => users.filter((user) => user.groups.some((group) => group.toLowerCase() === name)).length;
    return [
      { label: "Total users", value: users.length, icon: Users },
      { label: "Total groups", value: groups.length, icon: Shield },
      { label: "Students", value: inGroup("student"), icon: UserCheck },
      { label: "Lecturers", value: inGroup("lecturer"), icon: UserRound },
      { label: "Unassigned", value: users.filter((user) => user.groups.length === 0).length, icon: Activity },
    ];
  }, [users, groups]);

  const recent = users.slice(0, 6);
  const roleRows = groups.map((group) => ({
    name: group.name,
    count: users.filter((user) => user.groups.includes(group.name)).length,
  }));

  return (
    <AdminShell>
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">User and role overview from Django Groups.</p>
      </div>
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => <LoadingSkeleton key={index} className="h-28" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {metrics.map((metric) => <StatCard key={metric.label} {...metric} />)}
        </div>
      )}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Recent users</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recent.map((user) => (
              <div key={user.id} className="flex items-center justify-between rounded-xl border bg-white p-3">
                <div>
                  <p className="font-medium">{user.full_name || user.username}</p>
                  <p className="text-sm text-muted-foreground">{user.email || user.username}</p>
                </div>
                <Badge>{user.role_display}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>System status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-emerald-50 p-4 text-emerald-800">
              <p className="font-medium">JWT auth online</p>
              <p className="text-sm">Django Groups are the active role source.</p>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Role distribution</p>
              <div className="space-y-2">
                {roleRows.map((row) => (
                  <div key={row.name} className="flex items-center justify-between text-sm">
                    <span>{row.name}</span>
                    <Badge>{row.count}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminShell>
  );
}
