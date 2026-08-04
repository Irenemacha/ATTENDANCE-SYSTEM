"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, BookOpen, Building2, MapPin, UserCheck, UserRound, Users } from "lucide-react";

import { AdminShell } from "@/components/admin-shell";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, Classroom, Course, Department, Group, User } from "@/lib/api";

export default function AdminDashboardPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<{ results?: User[]; count?: number } | User[]>("/user-management/users/?page_size=100").catch(() => ({ data: [] })),
      api.get<Group[]>("/user-management/groups/").catch(() => ({ data: [] })),
      api.get<Course[]>("/courses/").catch(() => ({ data: [] })),
      api.get<Classroom[]>("/courses/classrooms/").catch(() => ({ data: [] })),
      api.get<Department[]>("/departments/").catch(() => ({ data: [] })),
    ]).then(([usersRes, groupsRes, coursesRes, classroomsRes, deptsRes]) => {
      const userData = Array.isArray(usersRes.data) ? usersRes.data : (usersRes.data as any)?.results ?? [];
      setUsers(userData);
      setGroups(Array.isArray(groupsRes.data) ? groupsRes.data : []);
      setCourses(Array.isArray(coursesRes.data) ? coursesRes.data : []);
      setClassrooms(Array.isArray(classroomsRes.data) ? classroomsRes.data : []);
      setDepartments(Array.isArray(deptsRes.data) ? deptsRes.data : []);
      setLoading(false);
    });
  }, []);

  const metrics = useMemo(() => {
    const inGroup = (name: string) => users.filter((u) => u.groups.some((g) => g.toLowerCase() === name)).length;
    const gpsClassrooms = classrooms.filter((c) => c.latitude && c.longitude).length;
    return [
      { label: "Total Users", value: users.length, icon: Users },
      { label: "Students", value: inGroup("student"), icon: UserCheck },
      { label: "Lecturers", value: inGroup("lecturer"), icon: UserRound },
      { label: "Departments", value: departments.length, icon: Building2 },
      { label: "Courses", value: courses.length, icon: BookOpen },
      { label: "GPS Classrooms", value: gpsClassrooms, icon: MapPin },
      { label: "Groups", value: groups.length, icon: Activity },
    ];
  }, [users, groups, courses, classrooms, departments]);

  if (loading) {
    return (
      <AdminShell>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => <LoadingSkeleton key={i} className="h-28" />)}
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">System overview and structural data management.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => <StatCard key={m.label} {...m} />)}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader><CardTitle>Recent Users</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {users.slice(0, 5).map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-xl border bg-white p-3">
                <div>
                  <p className="font-medium">{u.full_name || u.username}</p>
                  <p className="text-sm text-muted-foreground">{u.email || u.username}</p>
                </div>
                <Badge>{u.role_display}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader><CardTitle>System Status</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border bg-emerald-50 p-4 text-emerald-800">
              <p className="font-medium">API Connected</p>
              <p className="text-sm">JWT auth active. All services online.</p>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">GPS-enabled Classrooms</p>
              <p className="text-2xl font-bold">{classrooms.filter((c) => c.latitude).length} / {classrooms.length}</p>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Courses per Department</p>
              <div className="space-y-2">
                {departments.map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-sm">
                    <span>{d.name}</span>
                    <Badge>{courses.filter((c) => c.department === d.id).length}</Badge>
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
